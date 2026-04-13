import { Component, OnInit } from '@angular/core';
import { Auth, signOut, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, docData, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  user$: Observable<any> = of(null);

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
      } else {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }

  async editProfile(currentData: any) {
    const alert = await this.alertCtrl.create({
      header: 'Edit Profil & Skill',
      inputs: [
        {
          name: 'fullName',
          type: 'text',
          placeholder: 'Nama Lengkap',
          value: currentData.fullName
        },
        {
          name: 'bio', // Input Baru untuk Bio
          type: 'textarea',
          placeholder: 'Tulis bio singkatmu...',
          value: currentData.bio || ''
        },
        {
          name: 'skills',
          type: 'textarea',
          placeholder: 'Skill (Pisahkan dengan koma atau spasi)',
          value: currentData.skillsOffered ? currentData.skillsOffered.join(', ') : ''
        }
      ],
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Simpan',
          handler: (data) => {
            // Sekarang mengirim 3 parameter: Nama, Bio, dan Skills
            this.saveData(data.fullName, data.bio, data.skills);
          }
        }
      ]
    });
    await alert.present();
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
        
        // 1. Logika pemrosesan skill
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

        // 2. Update Firestore dengan field BIO
        await updateDoc(userDocRef, {
          fullName: newName,
          bio: newBio, // Simpan Bio ke Firestore
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