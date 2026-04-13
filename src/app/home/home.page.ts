import { Component, OnInit } from '@angular/core';
import { Firestore, doc, docData, collection, query, where, collectionData, updateDoc, deleteDoc } from '@angular/fire/firestore';
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

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        this.user$ = docData(userDocRef);
        this.loadDashboardData(user.uid);
      } else {
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
        return this.groupRequestsForChat(mySwaps, uid);
      })
    );

    const qIncoming = query(swapCollect, 
      where('toUid', '==', uid), 
      where('status', 'in', ['pending', 'rejected'])
    );
    this.incomingRequests$ = collectionData(qIncoming, { idField: 'id' }).pipe(
      map(requests => this.groupRequests(requests, 'fromUid', 'fromName'))
    );

    const qOutgoing = query(swapCollect, 
      where('fromUid', '==', uid), 
      where('status', 'in', ['pending', 'rejected'])
    );
    this.outgoingRequests$ = collectionData(qOutgoing, { idField: 'id' }).pipe(
      map(requests => this.groupRequests(requests, 'toUid', 'toName'))
    );
  }

  private groupRequestsForChat(swaps: any[], myUid: string) {
    const groups: any[] = [];
    swaps.forEach(s => {
      const isISender = s.fromUid === myUid;
      const partnerId = isISender ? s.toUid : s.fromUid;
      const partnerName = isISender ? s.toName : s.fromName;
      if (!groups.find(g => g.partnerId === partnerId)) {
        groups.push({ partnerId, partnerName, lastSkill: s.requestedSkill });
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
    this.router.navigate(['/chat-detail'], {
      queryParams: { id: partnerId, name: partnerName }
    });
  }

  async updateStatus(requestId: string, newStatus: 'accepted' | 'rejected') {
    try {
      const docRef = doc(this.firestore, `swaps/${requestId}`);
      await updateDoc(docRef, { status: newStatus });
      this.showToast(newStatus === 'accepted' ? 'Barter diterima!' : 'Barter ditolak.', 'success');
    } catch (error) {
      this.showToast('Gagal mengubah status.', 'danger');
    }
  }

  // FITUR BARU: HAPUS REQUEST PERMANEN
  async deleteRequest(requestId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Riwayat',
      message: 'Hapus permintaan ini dari daftar?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Hapus',
          handler: async () => {
            try {
              const docRef = doc(this.firestore, `swaps/${requestId}`);
              await deleteDoc(docRef);
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
      message: 'Apakah kamu yakin ingin keluar?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Ya, Keluar', handler: async () => { await signOut(this.auth); this.router.navigate(['/login']); } }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, color: color, position: 'bottom' });
    toast.present();
  }
}