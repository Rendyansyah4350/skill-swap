import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router'; // Tambahkan Router
import { 
  Firestore, 
  doc, 
  docData, 
  collection, 
  query, 
  where, 
  collectionData, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  getDocs // Tambahkan getDocs
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of, combineLatest, switchMap, filter, take } from 'rxjs'; 
import { map } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-profile-view',
  templateUrl: './profile-view.page.html',
  styleUrls: ['./profile-view.page.scss'],
  standalone: false,
})
export class ProfileViewPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router); // Tambahkan router injector
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private toastCtrl = inject(ToastController);

  profileData$: Observable<any> = of(null);
  partnerId: string = '';
  currentUid: string = '';
  
  // Variabel Rating
  reviews$: Observable<any[]> = of([]);
  averageRating: string = '0.0';
  totalReviews: number = 0;

  // Variabel Baru untuk Mendukung Modal (Tambahan)
  isRatingModalOpen: boolean = false;
  selectedScore: number = 5;
  commentText: string = '';

  ngOnInit() {
    this.partnerId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParams['id'];

    // Ambil UID user yang login secara instan
    authState(this.auth).pipe(take(1)).subscribe(user => {
      if (user) {
        this.currentUid = user.uid;
        // JALANKAN CEK BLOKIR SAAT MASUK PROFIL
        this.checkBlockStatus();
      }
    });

    if (this.partnerId) {
      this.loadRatings(this.partnerId);

      this.profileData$ = authState(this.auth).pipe(
        filter(currUser => !!currUser),
        switchMap(currentUser => {
          this.currentUid = currentUser.uid;
          
          const userRef = doc(this.firestore, `users/${this.partnerId}`);
          const userObs = docData(userRef);

          const swapCollect = collection(this.firestore, 'swaps');
          const q = query(
            swapCollect, 
            where('fromUid', 'in', [this.currentUid, this.partnerId]),
            where('toUid', 'in', [this.currentUid, this.partnerId])
          );
          const swapsObs = collectionData(q);

          return combineLatest([userObs, swapsObs]).pipe(
            map(([user, swaps]: [any, any[]]) => {
              if (!user) return null;

              const skillList = user.skillsOffered || [];
              const processedSkills = skillList.map((skillName: string) => {
                const swapInfo = swaps.find(s => s.requestedSkill === skillName);
                return {
                  name: skillName,
                  status: swapInfo ? swapInfo.status : 'none'
                };
              });

              return { ...user, processedSkills };
            })
          );
        })
      );
    }
  }

  // --- FUNGSI CEK STATUS BLOKIR (SANGAT PENTING) ---
  async checkBlockStatus() {
    if (!this.currentUid || !this.partnerId) return;

    const blockCol = collection(this.firestore, 'blocks');

    // KITA CUMA CEK: Apakah SAYA sedang diblokir oleh PARTNER?
    const q = query(blockCol, 
      where('blockerUid', '==', this.partnerId),
      where('blockedUid', '==', this.currentUid)  
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      this.showToast('Akses dibatasi oleh pengguna.', 'danger');
      this.router.navigate(['/tabs/home']); 
    }
  }
  // --- FUNGSI AJAK BARTER (KEAMANAN GANDA: CEK BLOKIR & DUPLIKAT) ---
  async kirimPermintaanBarter(skillTarget: string) {
    try {
      if (!this.currentUid || !this.partnerId) return;

      // 1. CEK STATUS BLOKIR LAGI SEBELUM KIRIM
      const blockCol = collection(this.firestore, 'blocks');
      const qBlock = query(blockCol, 
        where('blockerUid', 'in', [this.currentUid, this.partnerId]),
        where('blockedUid', 'in', [this.currentUid, this.partnerId])
      );
      const blockSnap = await getDocs(qBlock);
      if (!blockSnap.empty) {
        this.showToast('Gagal: Pengguna tidak dapat dihubungi.', 'danger');
        return;
      }

      // 2. CEK APAKAH SUDAH ADA PERMINTAAN PENDING/ACCEPTED UNTUK SKILL INI
      const swapCol = collection(this.firestore, 'swaps');
      const qSwap = query(swapCol, 
        where('fromUid', '==', this.currentUid),
        where('toUid', '==', this.partnerId),
        where('requestedSkill', '==', skillTarget), // Sesuai field di HTML Abang
        where('status', 'in', ['pending', 'accepted'])
      );
      const swapSnap = await getDocs(qSwap);

      if (!swapSnap.empty) {
        this.showToast('Anda sudah mengirim permintaan untuk skill ini!', 'warning');
        return;
      }

      // 3. JIKA LOLOS SEMUA, BARU ADD DOC
      await addDoc(swapCol, {
        fromUid: this.currentUid,
        toUid: this.partnerId,
        requestedSkill: skillTarget,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      this.showToast('Permintaan barter terkirim!', 'success');

    } catch (error) {
      console.error(error);
      this.showToast('Gagal mengirim permintaan.', 'danger');
    }
  }

  loadRatings(uid: string) {
    const ratingCol = collection(this.firestore, 'ratings');
    const q = query(ratingCol, where('toUid', '==', uid), orderBy('timestamp', 'desc'));

    this.reviews$ = collectionData(q).pipe(
      map(reviews => {
        if (reviews && reviews.length > 0) {
          const sum = reviews.reduce((acc, cur: any) => acc + Number(cur['rating']), 0);
          const avg = sum / reviews.length;
          this.averageRating = avg.toFixed(1);
          this.totalReviews = reviews.length;
        } else {
          this.averageRating = '0.0';
          this.totalReviews = 0;
        }
        return reviews;
      })
    );
  }

  // --- FUNGSI MODAL ---
  openRatingModal() {
    if (this.currentUid === this.partnerId) {
      this.showToast('Masa nilai diri sendiri bang?', 'warning');
      return;
    }
    this.selectedScore = 5;
    this.commentText = '';
    this.isRatingModalOpen = true;
  }

  confirmSubmitRating() {
    this.submitRating(this.selectedScore, this.commentText);
    this.isRatingModalOpen = false;
  }

  async submitRating(score: number, comment: string) {
    try {
      if (this.currentUid === this.partnerId) {
        this.showToast('Masa nilai diri sendiri bang?', 'warning');
        return;
      }
    
      const ratingCol = collection(this.firestore, 'ratings');
      await addDoc(ratingCol, {
        fromUid: this.currentUid,
        toUid: this.partnerId,
        rating: Number(score),
        comment: comment || '',
        timestamp: serverTimestamp()
      });
    
      this.showToast('Rating berhasil dikirim!', 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Gagal mengirim rating.', 'danger');
    }
  }

  async showToast(m: string, c: string) {
    const t = await this.toastCtrl.create({ message: m, duration: 2000, color: c });
    t.present();
  }
}