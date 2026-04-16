import { Component, OnInit } from '@angular/core';
import { Auth, signOut, onAuthStateChanged, deleteUser } from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  docData, 
  updateDoc, 
  collection, 
  query, 
  where, 
  collectionData, 
  deleteDoc, 
  getDoc, 
  orderBy 
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable, of, from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  user$: Observable<any> = of(null);

  // Variabel Edit Profil
  isModalOpen = false;
  tempData = {
    fullName: '',
    bio: '',
    skills: ''
  };

  // --- VARIABEL DAFTAR BLOKIR ---
  isBlockModalOpen = false;
  blockedUsers$: Observable<any[]> = of([]);

  // --- VARIABEL RATING SAYA ---
  myReviews$: Observable<any[]> = of([]);
  averageRating: string = '0.0';
  totalReviews: number = 0;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        this.user$ = docData(userDocRef);

        // Ambil Rating Milik Saya sendiri
        this.loadMyRatings(user.uid);
      } else {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }

  // --- LOGIC HAPUS AKUN ---
  async confirmDeleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Akun Permanen?',
      message: 'Semua profil, skill, dan data login Anda akan dihapus selamanya.',
      cssClass: 'danger-alert',
      buttons: [
        { 
          text: 'BATAL', 
          role: 'cancel',
          cssClass: 'alert-button-cancel' 
        },
        {
          text: 'YA, HAPUS',
          role: 'destructive',
          cssClass: 'alert-button-confirm',
          handler: () => this.executeDeleteAccount()
        }
      ]
    });
    await alert.present();
  }

  async executeDeleteAccount() {
    const loading = await this.loadingCtrl.create({
      message: 'Menghapus data Anda...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const user = this.auth.currentUser;
      if (user) {
        // 1. Hapus dokumen di Firestore (PENTING: Harus dilakukan sebelum hapus Auth)
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        await deleteDoc(userDocRef);

        // 2. Hapus user dari Firebase Authentication
        await deleteUser(user);

        await loading.dismiss();
        this.showToast('Akun berhasil dihapus.', 'success');
        this.router.navigate(['/login'], { replaceUrl: true });
      } else {
        await loading.dismiss();
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error delete account:', error);

      if (error.code === 'auth/requires-recent-login') {
        const alert = await this.alertCtrl.create({
          header: 'Verifikasi Ulang',
          message: 'Silakan Logout dan Login kembali untuk menghapus akun demi keamanan.',
          buttons: ['OK']
        });
        await alert.present();
      } else {
        this.showToast('Gagal menghapus akun.', 'danger');
      }
    }
  }

  // --- LOGIC AMBIL RATING SAYA ---
  loadMyRatings(uid: string) {
    const ratingCol = collection(this.firestore, 'ratings');
    const q = query(ratingCol, where('toUid', '==', uid), orderBy('timestamp', 'desc'));

    this.myReviews$ = collectionData(q).pipe(
      map(reviews => {
        if (reviews && reviews.length > 0) {
          const sum = reviews.reduce((acc, cur: any) => acc + Number(cur['rating']), 0);
          this.averageRating = (sum / reviews.length).toFixed(1);
          this.totalReviews = reviews.length;
        } else {
          this.averageRating = '0.0';
          this.totalReviews = 0;
        }
        return reviews;
      })
    );
  }

  // --- LOGIC DAFTAR BLOKIR ---
  openBlockedList() {
    this.isBlockModalOpen = true;
    this.loadBlockedUsers();
  }

  loadBlockedUsers() {
    const user = this.auth.currentUser;
    if (!user) return;

    const blockCol = collection(this.firestore, 'blocks');
    const q = query(blockCol, where('blockerUid', '==', user.uid));

    this.blockedUsers$ = collectionData(q, { idField: 'blockId' }).pipe(
      switchMap(blocks => {
        if (blocks.length === 0) return of([]);

        const userQueries = blocks.map(async (b: any) => {
          const userSnap = await getDoc(doc(this.firestore, `users/${b.blockedUid}`));
          return {
            blockId: b.blockId,
            name: userSnap.exists() ? userSnap.data()['fullName'] : 'User tidak dikenal',
            timestamp: b.timestamp
          };
        });

        return from(Promise.all(userQueries));
      })
    );
  }

  async unblockUser(blockId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Buka Blokir?',
      message: 'User ini akan bisa kembali melihat profil dan mengajak barter.',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Buka Blokir',
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, `blocks/${blockId}`));
              this.showToast('Blokir telah dibuka.', 'success');
            } catch (e) {
              this.showToast('Gagal membuka blokir.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // --- LOGIC EDIT PROFIL ---
  editProfile(currentData: any) {
    this.tempData = {
      fullName: currentData.fullName,
      bio: currentData.bio || '',
      skills: currentData.skillsOffered ? currentData.skillsOffered.join(', ') : ''
    };
    this.isModalOpen = true; 
  }

  confirmSave() {
    this.saveData(this.tempData.fullName, this.tempData.bio, this.tempData.skills);
    this.isModalOpen = false; 
  }

  async saveData(newName: string, newBio: string, skillString: string) {
    if (!newName.trim()) {
      this.showToast('Nama tidak boleh kosong!', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ 
      message: 'Menyimpan perubahan...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const user = this.auth.currentUser;
      if (user) {
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        
        const rawSkills = skillString
          ? skillString.split(/[ ,]+/).map(s => s.trim()).filter(s => s !== "")
          : [];

        const uniqueSkills: string[] = [];
        const seen = new Set();

        for (const skill of rawSkills) {
          const lowerSkill = skill.toLowerCase();
          if (!seen.has(lowerSkill)) {
            seen.add(lowerSkill);
            uniqueSkills.push(skill);
          }
        }

        await updateDoc(userDocRef, {
          fullName: newName,
          bio: newBio, 
          skillsOffered: uniqueSkills
        });

        this.showToast('Profil berhasil diperbarui!', 'success');
      }
      await loading.dismiss();
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error:', error);
      this.showToast('Gagal menyimpan data.', 'danger');
    }
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
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}