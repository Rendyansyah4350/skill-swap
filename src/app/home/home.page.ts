import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { 
  Firestore, doc, docData, collection, query, where, 
  collectionData, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, getDoc
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  user$: Observable<any> = of(null);
  acceptedChats$: Observable<any[]> = of([]);
  incomingRequests$: Observable<any[]> = of([]);
  outgoingRequests$: Observable<any[]> = of([]);
  segment: string = 'chat';

  unreadCounts: any = {};
  currentUserId: string = '';
  userRatings: any = {}; 

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private router: Router,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        // --- LOGIC SATPAM ANTI HANTU ---
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
          console.warn("Akun tidak ditemukan di database. Mengeluarkan user...");
          await signOut(this.auth);
          this.router.navigate(['/login'], { replaceUrl: true });
          this.showToast("Akun Anda sudah dihapus.", "danger");
          return;
        }

        this.currentUserId = user.uid;
        this.user$ = docData(userDocRef);
        this.loadDashboardData(user.uid);
      } else {
        this.currentUserId = '';
        this.user$ = of(null);
        this.router.navigate(['/login']);
      }
    });
  }

  loadDashboardData(uid: string) {
    const swapCollect = collection(this.firestore, 'swaps');

    const qAccepted = query(swapCollect, where('status', '==', 'accepted'));
    this.acceptedChats$ = collectionData(qAccepted, { idField: 'id' }).pipe(
      map(swaps => {
        const mySwaps = swaps.filter(s => s['fromUid'] === uid || s['toUid'] === uid);
        
        mySwaps.sort((a, b) => {
          const timeA = a['lastMessageTimestamp']?.seconds || 0;
          const timeB = b['lastMessageTimestamp']?.seconds || 0;
          return timeB - timeA;
        });

        const grouped = this.groupRequestsForChat(mySwaps, uid);
        grouped.forEach(chat => {
          this.listenToUnreadCount(chat.partnerId);
          this.listenToUserRating(chat.partnerId); 
        });
        return grouped;
      })
    );

    const qIncoming = query(swapCollect, 
      where('toUid', '==', uid), 
      where('status', 'in', ['pending', 'rejected'])
    );
    this.incomingRequests$ = collectionData(qIncoming, { idField: 'id' }).pipe(
      map(requests => {
        const grouped = this.groupRequests(requests, 'fromUid', 'fromName');
        grouped.forEach(g => this.listenToUserRating(g.partnerId)); 
        return grouped;
      })
    );

    const qOutgoing = query(swapCollect, 
      where('fromUid', '==', uid), 
      where('status', 'in', ['pending', 'rejected'])
    );
    this.outgoingRequests$ = collectionData(qOutgoing, { idField: 'id' }).pipe(
      map(requests => {
        const grouped = this.groupRequests(requests, 'toUid', 'toName');
        grouped.forEach(g => this.listenToUserRating(g.partnerId)); 
        return grouped;
      })
    );
  }

  async confirmDeletePartner(partnerId: string, partnerName: string) {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Partner',
      message: `Hapus ${partnerName} dari partner? Ini akan menghapus riwayat chat dan barter.`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { 
          text: 'Ya, Hapus', 
          role: 'destructive',
          handler: () => this.deletePartner(partnerId)
        }
      ]
    });
    await alert.present();
  }

  async deletePartner(partnerId: string) {
    try {
      const uid = this.currentUserId;
      const combinedIds = [uid, partnerId].sort();
      const chatId = combinedIds[0] + '_' + combinedIds[1];
    
      const swapCollect = collection(this.firestore, 'swaps');
      const q = query(swapCollect);
      const snap = await getDocs(q);
      
      snap.forEach(async (document) => {
        const data = document.data();
        if ((data['fromUid'] === uid && data['toUid'] === partnerId) || 
            (data['fromUid'] === partnerId && data['toUid'] === uid)) {
          await deleteDoc(doc(this.firestore, `swaps/${document.id}`));
        }
      });
    
      await deleteDoc(doc(this.firestore, `chats/${chatId}`));
      this.showToast('Partner dan riwayat chat berhasil dihapus.', 'success');
    } catch (error) {
      console.error(error);
      this.showToast('Gagal menghapus data.', 'danger');
    }
  }

  private listenToUserRating(uid: string) {
    if (this.userRatings[uid]) return; 
    const ratingCol = collection(this.firestore, 'ratings');
    const q = query(ratingCol, where('toUid', '==', uid));
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const reviews = snap.docs.map(d => d.data());
        const sum = reviews.reduce((acc, cur: any) => acc + Number(cur['rating']), 0);
        this.userRatings[uid] = (sum / reviews.length).toFixed(1);
      } else {
        this.userRatings[uid] = '0.0';
      }
      this.cdr.detectChanges();
    });
  }

  async cancelRequest(requestId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Batalkan Permintaan',
      message: 'Apakah kamu yakin ingin membatalkan permintaan barter ini?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { 
          text: 'Ya, Batalkan', 
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, `swaps/${requestId}`));
              this.showToast('Permintaan berhasil dibatalkan.', 'success');
            } catch (error) {
              this.showToast('Gagal membatalkan permintaan.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private listenToUnreadCount(partnerId: string) {
    const combinedIds = [this.currentUserId, partnerId].sort();
    const chatId = combinedIds[0] + '_' + combinedIds[1];
    const msgCol = collection(this.firestore, `chats/${chatId}/messages`);
    const qUnread = query(msgCol, where('isRead', '==', false), where('senderId', '!=', this.currentUserId));
    onSnapshot(qUnread, (snap) => {
      this.unreadCounts[partnerId] = snap.size;
      this.cdr.detectChanges(); 
    });
  }

  private groupRequestsForChat(swaps: any[], myUid: string) {
    const groups: any[] = [];
    swaps.forEach(s => {
      const isISender = s.fromUid === myUid;
      const partnerId = isISender ? s.toUid : s.fromUid;
      const partnerName = isISender ? s.toName : s.fromName;
      if (!groups.find(g => g.partnerId === partnerId)) {
        groups.push({ 
          partnerId, 
          partnerName, 
          lastSkill: s.requestedSkill,
          lastMsg: s.lastMessageText || 'Klik untuk lanjut diskusi...' 
        });
      }
    });
    return groups;
  }

  private groupRequests(requests: any[], idKey: string, nameKey: string) {
    const groups: any[] = [];
    requests.forEach(req => {
      const pId = req[idKey];
      const pName = req[nameKey] || 'User';
      let group = groups.find(g => g.partnerId === pId);
      if (!group) {
        group = { partnerId: pId, partnerName: pName, skills: [] };
        groups.push(group);
      }
      group.skills.push({ id: req.id, name: req.requestedSkill, status: req.status });
    });
    return groups;
  }

  openChat(partnerId: string, partnerName: string) {
    this.router.navigate(['/chat-detail'], { queryParams: { id: partnerId, name: partnerName } });
  }

  goToPartnerProfile(partnerId: string) {
    this.router.navigate(['/profile-view'], { queryParams: { id: partnerId } });
  }

  async updateStatus(requestId: string, newStatus: 'accepted' | 'rejected') {
    try {
      await updateDoc(doc(this.firestore, `swaps/${requestId}`), { 
        status: newStatus,
        lastMessageTimestamp: serverTimestamp()
      });
      this.showToast(newStatus === 'accepted' ? 'Barter diterima!' : 'Barter ditolak.', 'success');
    } catch (error) {
      console.error(error);
      this.showToast('Gagal mengubah status.', 'danger');
    }
  }

  async deleteRequest(requestId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Riwayat',
      message: 'Hapus permintaan ini dari daftar?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Hapus', handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, `swaps/${requestId}`));
              this.showToast('Permintaan berhasil dihapus.', 'success');
            } catch (error) {
              this.showToast('Gagal menghapus data.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Keluar',
      message: 'Apakah Anda yakin ingin keluar?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Ya, Keluar',
          handler: async () => {
            await signOut(this.auth);
            this.router.navigate(['/login'], { replaceUrl: true });
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, color: color, position: 'bottom' });
    toast.present();
  }
}