import { Component } from '@angular/core';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false
})
export class ForgotPasswordPage {
  email: string = '';

  constructor(
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router
  ) {}

  async resetPassword() {
    if (!this.email) {
      this.showToast('Masukkan email kamu Terlebih dahulu!', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Mengirim email reset...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      await loading.dismiss();
      
      this.showToast('Link reset password sudah dikirim di dalam spam ke email kamu!', 'success');
      this.router.navigate(['/login']);
    } catch (error: any) {
      await loading.dismiss();
      let msg = 'Gagal mengirim email.';
      if (error.code === 'auth/user-not-found') msg = 'Email tidak terdaftar!';
      this.showToast(msg, 'danger');
    }
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 3000, color: color, position: 'bottom' });
    toast.present();
  }
}