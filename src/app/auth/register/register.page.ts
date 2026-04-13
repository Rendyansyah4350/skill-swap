// src/app/pages/register/register.page.ts
import { Component } from '@angular/core';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular'; 

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {
  // Variabel untuk toggle mata password
  showPassword = false;

  // Model untuk form
  userData = {
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    skillsOffered: '', 
  };

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private alertCtrl: AlertController,   // Injeksi Alert
    private loadingCtrl: LoadingController // Injeksi Loading
  ) {}

  // Fungsi toggle password
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  // Fungsi pembantu untuk memunculkan Popup Alert
  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async register() {
    // 1. Validasi awal: Cek apakah ada field yang kosong
    if (!this.userData.email || !this.userData.password || !this.userData.fullName) {
      this.showAlert('Peringatan', 'Semua kolom wajib diisi!');
      return;
    }

    // 2. Validasi: Cek apakah password dan confirm password cocok
    if (this.userData.password !== this.userData.confirmPassword) {
      this.showAlert('Kesalahan', 'Password dan Konfirmasi Password tidak cocok!');
      return;
    }

    // 3. Munculkan Loading Animasi
    const loading = await this.loadingCtrl.create({
      message: 'Sedang mendaftarkan akun...',
      spinner: 'crescent' 
    });
    await loading.present();

    try {
      // 4. Buat user di Firebase Auth
      const credential = await createUserWithEmailAndPassword(
        this.auth, 
        this.userData.email, 
        this.userData.password
      );

      // 5. Simpan detail profil ke Firestore menggunakan UID dari Auth
      const userDocRef = doc(this.firestore, `users/${credential.user.uid}`);
      await setDoc(userDocRef, {
        uid: credential.user.uid,
        fullName: this.userData.fullName,
        email: this.userData.email,
        skillsOffered: this.userData.skillsOffered ? this.userData.skillsOffered.split(',') : [], 
        createdAt: new Date()
      });

      // Hilangkan loading setelah selesai
      await loading.dismiss();

      // Popup Berhasil
      await this.showAlert('Berhasil', 'Registrasi Berhasil! Silakan login.');
      this.router.navigate(['/login']);

    } catch (error: any) {
      // Hilangkan loading jika gagal
      await loading.dismiss();

      console.error('Registrasi Gagal:', error.message);
      
      // Berikan pesan error yang ramah pengguna
      let msg = 'Registrasi Gagal. Silakan coba lagi.';
      if (error.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar!';
      if (error.code === 'auth/weak-password') msg = 'Password terlalu lemah (minimal 6 karakter).';
      
      this.showAlert('Registrasi Gagal', msg);
    }
  }
}