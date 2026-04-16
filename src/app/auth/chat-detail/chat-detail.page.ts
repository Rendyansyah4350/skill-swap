import { Component, OnInit, ViewChild, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  where,
  collectionData, 
  serverTimestamp, 
  doc,
  getDoc,
  getDocs, 
  updateDoc, 
  setDoc,
  writeBatch,
  deleteDoc,
  docData
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { IonContent, ToastController, ActionSheetController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  standalone: false,
})
export class ChatDetailPage implements OnInit, OnDestroy {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  partnerName: string = '';
  partnerId: string = '';
  currentUserId: string = '';
  newMessage: string = '';
  messages$: Observable<any[]> = of([]);
  chatId: string = '';

  // --- VARIABEL CEK AKUN AKTIF ---
  isPartnerActive: boolean = true;
  
  private msgSubscription?: Subscription;
  private authUnsubscribe?: Unsubscribe;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private auth: Auth,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.partnerId = params['id'];
      this.partnerName = params['name'];

      this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.checkPartnerStatus(); // Cek apakah partner masih ada di DB
          this.setupChat();
        } else {
          this.router.navigate(['/login']);
        }
      });
    });
  }

  // --- LOGIC CEK KEBERADAAN AKUN ---
  async checkPartnerStatus() {
    if (!this.partnerId) return;
    const partnerDocRef = doc(this.firestore, `users/${this.partnerId}`);
    
    // Gunakan docData agar jika akun dihapus saat kita sedang chat, UI langsung berubah
    docData(partnerDocRef).subscribe(user => {
      if (!user) {
        this.isPartnerActive = false;
        this.partnerName = "Akun Tidak Aktif";
      } else {
        this.isPartnerActive = true;
      }
    });
  }

  async presentActionSheet() {
    // Jika partner tidak aktif, beberapa opsi mungkin tidak relevan
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opsi Chat',
      cssClass: 'custom-delete-sheet',
      buttons: [
        {
          text: 'Lihat Profil',
          icon: 'person-outline',
          handler: () => {
            this.goToPartnerProfile();
          }
        },
        {
          text: 'Block Partner',
          role: 'destructive',
          icon: 'ban-outline',
          handler: () => {
            this.confirmBlock();
          }
        },
        {
          text: 'Batal',
          role: 'cancel',
          icon: 'close-outline'
        }
      ]
    });
    await actionSheet.present();
  }

  async confirmBlock() {
  const alert = await this.alertCtrl.create({
    header: 'Blokir Partner?',
    message: `Setelah diblokir, ${this.partnerName} tidak akan bisa mengirim pesan atau melihat profil Anda lagi.`,
    buttons: [
      { text: 'Batal', role: 'cancel' },
      {
        text: 'Ya, Blokir',
        role: 'destructive',
        handler: () => this.executeBlock()
      }
    ]
  });
  await alert.present();
}

  async executeBlock() {
    try {
      const blockCol = collection(this.firestore, 'blocks');

      const q = query(blockCol, 
        where('blockerUid', '==', this.currentUserId),
        where('blockedUid', '==', this.partnerId)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        await addDoc(blockCol, {
          blockerUid: this.currentUserId,
          blockedUid: this.partnerId,
          timestamp: serverTimestamp()
        });
        this.showToast(`${this.partnerName} telah diblokir.`, 'danger');
      } else {
        this.showToast(`User ini sudah masuk daftar blokir.`, 'warning');
      }

      this.router.navigate(['/tabs/home']);

    } catch (err) {
      console.error(err);
      this.showToast('Gagal memproses blokir.', 'warning');
    }
  }

  goToPartnerProfile() {
    if (!this.isPartnerActive) {
      this.showToast('Akun ini sudah dihapus.', 'dark');
      return;
    }
    if (this.partnerId) {
      this.router.navigate(['/profile-view'], { 
        queryParams: { id: this.partnerId } 
      });
    }
  }

  setupChat() {
    if (this.currentUserId && this.partnerId) {
      const combinedIds = [this.currentUserId, this.partnerId].sort();
      this.chatId = combinedIds[0] + '_' + combinedIds[1];
      this.loadMessages();
    }
  }

  loadMessages() {
    const msgCollection = collection(this.firestore, `chats/${this.chatId}/messages`);
    const q = query(msgCollection, orderBy('timestamp', 'asc'));

    this.messages$ = (collectionData(q, { idField: 'id' }) as Observable<any[]>).pipe(
      map(messages => {
        return messages.filter(msg => {
          const hiddenBy = msg['hiddenBy'] || [];
          return !hiddenBy.includes(this.currentUserId);
        });
      })
    );

    if (this.msgSubscription) this.msgSubscription.unsubscribe();
    this.msgSubscription = this.messages$.subscribe((messages) => {
      this.updateMessagesToRead(messages);
      this.scrollToBottom();
    });
  }

  private async updateMessagesToRead(messages: any[]) {
    const unread = messages.filter(msg => msg['senderId'] !== this.currentUserId && msg['isRead'] === false);
    if (unread.length > 0) {
      const batch = writeBatch(this.firestore);
      unread.forEach(msg => {
        const msgRef = doc(this.firestore, `chats/${this.chatId}/messages/${msg.id}`);
        batch.update(msgRef, { isRead: true });
      });
      await batch.commit();
    }
  }

async sendMessage() {
    if (!this.newMessage.trim() || !this.isPartnerActive) return;

    try {
      const blockCol = collection(this.firestore, 'blocks');
      const qBlock = query(blockCol, 
        where('blockerUid', 'in', [this.currentUserId, this.partnerId]),
        where('blockedUid', 'in', [this.currentUserId, this.partnerId])
      );
      
      const blockSnap = await getDocs(qBlock);
      
      if (!blockSnap.empty) {
        this.showToast('Tidak dapat mengirim pesan.', 'dark');
        this.newMessage = ''; 
        return;
      }

      const messageToSend = this.newMessage;
      this.newMessage = ''; 

      const chatDocRef = doc(this.firestore, `chats/${this.chatId}`);
      await setDoc(chatDocRef, { 
        lastUpdated: serverTimestamp(),
        participants: [this.currentUserId, this.partnerId]
      }, { merge: true });

      const msgCollection = collection(this.firestore, `chats/${this.chatId}/messages`);
      await addDoc(msgCollection, {
        text: messageToSend,
        senderId: this.currentUserId,
        timestamp: serverTimestamp(),
        isRead: false
      });
    
    } catch (error) {
      console.error("Gagal kirim pesan:", error);
      this.showToast('Gagal mengirim pesan.', 'danger');
    }
  }

  async presentDeleteOptions(msg: any) {
    const buttons: any[] = [
      {
        text: 'Hapus untuk saya',
        icon: 'trash-outline',
        handler: () => { this.deleteMessageForMe(msg); }
      }
    ];

    if (msg.senderId === this.currentUserId) {
      buttons.push({
        text: 'Hapus untuk semua orang',
        role: 'destructive',
        icon: 'trash-bin-outline',
        handler: () => { this.deleteMessageForAll(msg); }
      });
    }

    buttons.push({ text: 'Batal', icon: 'close-outline', role: 'cancel' });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opsi Pesan',
      subHeader: 'Pilih tindakan untuk pesan ini',
      cssClass: 'custom-delete-sheet', 
      buttons: buttons
    });
    await actionSheet.present();
  }

  async deleteMessageForMe(msg: any) {
    try {
      const msgRef = doc(this.firestore, `chats/${this.chatId}/messages/${msg.id}`);
      const hiddenBy = msg.hiddenBy || [];
      if (!hiddenBy.includes(this.currentUserId)) {
        hiddenBy.push(this.currentUserId);
      }
      await updateDoc(msgRef, { hiddenBy: hiddenBy });
      this.showToast('Pesan dihapus.', 'medium');
    } catch (e) {
      this.showToast('Gagal menghapus pesan.', 'danger');
    }
  }

  async deleteMessageForAll(msg: any) {
    try {
      const msgRef = doc(this.firestore, `chats/${this.chatId}/messages/${msg.id}`);
      await deleteDoc(msgRef);
      this.showToast('Pesan ditarik.', 'success');
    } catch (e) {
      this.showToast('Gagal menarik pesan.', 'danger');
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.content) this.content.scrollToBottom(300);
    }, 300);
  }

  async showToast(m: string, c: string) {
    const t = await this.toastCtrl.create({ message: m, duration: 2000, color: c });
    t.present();
  }

  ngOnDestroy() {
    if (this.authUnsubscribe) this.authUnsubscribe();
    if (this.msgSubscription) this.msgSubscription.unsubscribe();
  }

  ionViewWillLeave() {
    this.ngOnDestroy();
  }
}