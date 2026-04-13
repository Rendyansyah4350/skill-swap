import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, query, orderBy, collectionData, serverTimestamp, doc, updateDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators'; // Tambahkan ini
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
    private router: Router,
    private firestore: Firestore,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.partnerId = params['id'];
      this.partnerName = params['name'];

      this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.setupChat();
        } else {
          this.router.navigate(['/login']);
        }
      });
    });
  }

  goToPartnerProfile() {
    if (this.partnerId) {
      this.router.navigate(['/profile-view'], { 
        queryParams: { id: this.partnerId } 
      });
    }
  }

  ngOnDestroy() {
    if (this.authUnsubscribe) this.authUnsubscribe();
    if (this.msgSubscription) this.msgSubscription.unsubscribe();
  }

  setupChat() {
    if (this.currentUserId && this.partnerId) {
      const combinedIds = [this.currentUserId, this.partnerId].sort();
      this.chatId = combinedIds[0] + '_' + combinedIds[1];
      this.loadMessages();
    }
  }

  loadMessages() {
    // Sesuaikan path dengan fungsi sendMessage (chats/ID/messages)
    const msgCollection = collection(this.firestore, `chats/${this.chatId}/messages`);
    const q = query(msgCollection, orderBy('timestamp', 'asc'));
    
    // Tambahkan idField: 'id' agar bisa update isRead
    this.messages$ = collectionData(q, { idField: 'id' }).pipe(
      map(messages => {
        messages.forEach(async (msg: any) => {
          // LOGIC: Jika pesan dari partner & belum dibaca, tandai as READ
          if (msg.senderId !== this.currentUserId && !msg.isRead) {
            const msgRef = doc(this.firestore, `chats/${this.chatId}/messages/${msg.id}`);
            await updateDoc(msgRef, { isRead: true });
          }
        });
        return messages;
      })
    );

    if (this.msgSubscription) this.msgSubscription.unsubscribe();
    this.msgSubscription = this.messages$.subscribe(() => {
      this.scrollToBottom();
    });
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;
  
    try {
      const msgCollection = collection(this.firestore, `chats/${this.chatId}/messages`);
    
      await addDoc(msgCollection, {
        text: this.newMessage,
        senderId: this.currentUserId,
        timestamp: serverTimestamp(),
        isRead: false // Pengirim set default false
      });
    
      this.newMessage = ''; 
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