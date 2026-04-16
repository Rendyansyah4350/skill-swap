import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router'; 
import { 
  Firestore, 
  doc, 
  docData, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  getDoc,
  orderBy,
  collectionData 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth'; 
import { Observable, Subscription, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AlertController, ToastController } from '@ionic/angular'; 

@Component({
  selector: 'app-user-detail',
  templateUrl: './user-detail.page.html',
  styleUrls: ['./user-detail.page.scss'],
  standalone: false,
})
export class UserDetailPage implements OnInit, OnDestroy {
  user$: Observable<any> | undefined;
  targetUser: any; 
  private userSub: Subscription | undefined;

  reviews$: Observable<any[]> = of([]);
  averageRating: string = '0.0';
  totalReviews: number = 0;

  // --- VARIABEL BARU ---
  isBlockedMe: boolean = false; // Flag status blokir
  isSwapModalOpen = false;
  selectedSkillsMap: { [key: string]: boolean } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router, 
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('id');
    
    if (userId) {
      const myUid = this.auth.currentUser?.uid;
      
      // Panggil cek blokir (Tapi tidak menendang keluar)
      if (myUid) {
        this.checkBlockStatus(myUid, userId);
      }

      const userDocRef = doc(this.firestore, `users/${userId}`);
      this.user$ = docData(userDocRef);
      
      this.userSub = this.user$.subscribe(data => {
        if (data) {
          this.targetUser = data;
          this.targetUser.uid = userId; 
        }
      });

      this.loadRatings(userId);
    }
  }

  // --- REVISI: Cek blokir satu arah (Hanya set variabel isBlockedMe) ---
  async checkBlockStatus(myUid: any, partnerId: string) {
    const blockCol = collection(this.firestore, 'blocks');
    const q = query(blockCol, 
      where('blockerUid', '==', partnerId), // Dia pemblokir
      where('blockedUid', '==', myUid)      // Saya korban
    );

    const snap = await getDocs(q);
    this.isBlockedMe = !snap.empty; // TRUE jika saya diblokir oleh dia
  }

  loadRatings(uid: string) {
    const ratingCol = collection(this.firestore, 'ratings');
    const q = query(ratingCol, where('toUid', '==', uid), orderBy('timestamp', 'desc'));
    
    this.reviews$ = collectionData(q).pipe(
      map(reviews => {
        if (reviews && reviews.length > 0) {
          const sum = reviews.reduce((acc, cur: any) => acc + Number(cur['rating']), 0);
          this.averageRating = (sum / reviews.length).toFixed(1);
          this.totalReviews = reviews.length;
        }
        return reviews;
      })
    );
  }

  ngOnDestroy() {
    if (this.userSub) this.userSub.unsubscribe();
  }

  async openSwapModal() {
    // 1. PROTEKSI: Cek apakah SAYA yang memblokir DIA
    try {
      const blockCol = collection(this.firestore, 'blocks');
      const q = query(blockCol, 
        where('blockerUid', '==', this.auth.currentUser?.uid),
        where('blockedUid', '==', this.targetUser?.uid)
      );
      const blockSnap = await getDocs(q);
    
      if (!blockSnap.empty) {
        const alert = await this.alertCtrl.create({
          header: 'Akses Dibatasi',
          message: `Anda sedang memblokir ${this.targetUser?.fullName}. Buka blokir terlebih dahulu di menu Profil jika ingin mengajak barter kembali.`,
          cssClass: 'danger-alert', // Menggunakan class popup yang kita buat tadi
          buttons: ['MENGERTI']
        });
        await alert.present();
        return;
      }
    } catch (error) {
      console.error("Error checking block status:", error);
    }
  
    // 2. PROTEKSI: Jika DIA memblokir SAYA
    if (this.isBlockedMe) {
      this.showToast("Gagal: Pengguna membatasi interaksi.", "danger");
      return;
    }
  
    // 3. PROTEKSI: Barter sama diri sendiri
    if (this.auth.currentUser?.uid === this.targetUser?.uid) {
      this.showToast("Masa mau barter sama diri sendiri, bang? :D", "warning");
      return;
    }
  
    // 4. PROTEKSI: Data belum siap
    if (!this.targetUser || !this.targetUser.skillsOffered) {
      this.showToast("Data user belum siap atau skill kosong.", "danger");
      return;
    }
  
    this.selectedSkillsMap = {};
    this.isSwapModalOpen = true; 
  }

  async confirmSwapRequest() {
    const selectedSkills = Object.keys(this.selectedSkillsMap).filter(key => this.selectedSkillsMap[key]);

    if (selectedSkills && selectedSkills.length > 0) {
      this.isSwapModalOpen = false;
      await this.saveToFirestore(selectedSkills);
    } else {
      this.showToast('Pilih minimal satu skill dulu ya!', 'warning');
    }
  }

  async saveToFirestore(skillNames: string[]) {
    try {
      const swapCollect = collection(this.firestore, 'swaps');
      const myUid = this.auth.currentUser?.uid;
      const partnerId = this.targetUser.uid;
      
      if (!myUid) return;

      // CEK BLOKIR LAGI SEBELUM SAVE
      const blockCol = collection(this.firestore, 'blocks');
      const qBlock = query(blockCol, 
        where('blockerUid', '==', partnerId),
        where('blockedUid', '==', myUid)
      );
      const blockSnap = await getDocs(qBlock);
      if (!blockSnap.empty) {
        this.showToast('Gagal: Pengguna tidak dapat dihubungi.', 'danger');
        return;
      }

      const myDocRef = doc(this.firestore, `users/${myUid}`);
      const myDocSnap = await getDoc(myDocRef);
      const myFullName = myDocSnap.exists() ? myDocSnap.data()['fullName'] : 'User';
      
      let countSuccess = 0;
      let countDuplicate = 0;

      await Promise.all(skillNames.map(async (skillName) => {
        // CEK DUPLIKAT (Pending ATAU Accepted)
        const q = query(
          swapCollect,
          where('fromUid', '==', myUid),
          where('toUid', '==', partnerId),
          where('requestedSkill', '==', skillName),
          where('status', 'in', ['pending', 'accepted']) 
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await addDoc(swapCollect, {
            fromUid: myUid,
            fromName: myFullName, 
            toUid: partnerId,
            toName: this.targetUser.fullName,
            requestedSkill: skillName,
            status: 'pending',
            participants: [myUid, partnerId], 
            createdAt: serverTimestamp()
          });
          countSuccess++;
        } else {
          countDuplicate++;
        }
      }));

      if (countSuccess > 0) this.showToast(`${countSuccess} ajakan berhasil dikirim!`, 'success');
      if (countDuplicate > 0) this.showToast(`Skill sudah ada dalam daftar permintaan aktif.`, 'warning');

    } catch (error) {
      this.showToast('Waduh, gagal kirim request nih.', 'danger');
    }
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, color: color, position: 'bottom' });
    toast.present();
  }
}

