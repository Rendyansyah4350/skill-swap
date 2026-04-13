import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router'; // Tambah Router
import { Firestore, collection, addDoc, query, where, orderBy, collectionData, serverTimestamp } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Observable, of, Subscription } from 'rxjs';
import { IonContent } from '@ionic/angular';

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
  
  private msgSubscription?: Subscription;
  private authUnsubscribe?: Unsubscribe;

  constructor(
    private route: ActivatedRoute,
    private router: Router, // Inject Router untuk pindah ke profil
    private firestore: Firestore,
    private auth: Auth
  ) {}

  ngOnInit() {
    // 1. Ambil data dari parameter URL
    this.route.queryParams.subscribe(params => {
      this.partnerId = params['id'];
      this.partnerName = params['name'];

      // 2. Monitor Auth State
      this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.setupChat();
        } else {
          console.error("User tidak terdeteksi.");
          this.router.navigate(['/login']);
        }
      });
    });
  }

  // FITUR BARU: Pindah ke halaman profil partner
  goToPartnerProfile() {
    if (this.partnerId) {
      this.router.navigate(['/profile-view'], { 
        queryParams: { id: this.partnerId } 
      });
    }
  }

  ngOnDestroy() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
    if (this.msgSubscription) {
      this.msgSubscription.unsubscribe();
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
    const msgCollection = collection(this.firestore, 'messages');
    const q = query(
      msgCollection,
      where('chatId', '==', this.chatId),
      orderBy('createdAt', 'asc')
    );
    
    this.messages$ = collectionData(q, { idField: 'id' });

    if (this.msgSubscription) this.msgSubscription.unsubscribe();
    this.msgSubscription = this.messages$.subscribe(() => {
      this.scrollToBottom();
    });
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;

    const textToSend = this.newMessage;
    this.newMessage = ''; 

    try {
      await addDoc(collection(this.firestore, 'messages'), {
        chatId: this.chatId,
        senderId: this.currentUserId,
        text: textToSend,
        createdAt: serverTimestamp()
      });
      this.scrollToBottom();
    } catch (error) {
      console.error("Gagal kirim pesan:", error);
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.content) {
        this.content.scrollToBottom(300);
      }
    }, 300);
  }

  ionViewWillLeave() {
    this.ngOnDestroy();
  }
}