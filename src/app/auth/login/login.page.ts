// src/app/pages/login/login.page.ts
import { Component } from '@angular/core';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Router } from '@angular/router';
// Import AlertController dan LoadingController
import { AlertController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  showPassword = false;
  loginData = {
    email: '',
    password: ''
  };

  constructor(
    private auth: Auth,
    private router: Router,
    private alertCtrl: AlertController,   // Injeksi Alert
    private loadingCtrl: LoadingController // Injeksi Loading
  ) {}

  goToRegister() {
    this.router.navigate(['/register']);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
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

  async login() {
    // 1. Validasi awal
    if (!this.loginData.email || !this.loginData.password) {
      this.showAlert('Peringatan', 'Email dan Password wajib diisi!');
      return;
    }

    // 2. Munculkan Animasi Loading
    const loading = await this.loadingCtrl.create({
      message: 'Loading...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // 3. Proses Sign In ke Firebase
      const credential = await signInWithEmailAndPassword(
        this.auth,
        this.loginData.email,
        this.loginData.password
      );
      
      console.log('Login Berhasil:', credential.user.uid);
      
      // Hilangkan loading setelah berhasil
      await loading.dismiss();
      
      // Langsung arahkan ke home
      this.router.navigate(['/tabs/home']); 
      
    } catch (error: any) {
      // Hilangkan loading jika gagal
      await loading.dismiss();

      console.error('Login Gagal:', error.message);
      
      // Logika pesan error
      let message = 'Email atau Password salah.';
      
      // Firebase Auth terkadang memberikan error code yang berbeda tergantung versi
      if (error.code === 'auth/user-not-found') message = 'Akun tidak ditemukan.';
      if (error.code === 'auth/wrong-password') message = 'Password yang Anda masukkan salah.';
      if (error.code === 'auth/invalid-email') message = 'Format email tidak valid.';
      
      this.showAlert('Login Gagal', message);
    }
  }
}