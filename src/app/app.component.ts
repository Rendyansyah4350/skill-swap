import { Component } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular'; // Tambahkan AlertController
import { Router } from '@angular/router';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private router: Router,
    private alertCtrl: AlertController // Injeksi AlertController
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.handleBackButton();
    });
  }

  handleBackButton() {
    this.platform.backButton.subscribeWithPriority(10, () => {
      const url = this.router.url;

      // Cek apakah user ada di halaman utama/akar
      if (url === '/tabs/home' || url === '/login' || url === '/tabs/explore' || url === '/tabs/profile') {
        this.presentExitConfirm(); // Panggil popup konfirmasi
      } else {
        // Jika di halaman lain (detail chat, dll), balik ke halaman sebelumnya
        window.history.back();
      }
    });
  }

  // FUNGSI POPUP KONFIRMASI KELUAR
  async presentExitConfirm() {
    const alert = await this.alertCtrl.create({
      header: 'Keluar Aplikasi',
      message: 'Apakah Anda yakin ingin menutup aplikasi Skill-Swap?',
      cssClass: 'custom-exit-alert', // Bisa Abang hias di global.scss nanti
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            console.log('User membatalkan keluar');
          }
        }, {
          text: 'Keluar',
          handler: () => {
            App.exitApp(); // Benar-benar keluar aplikasi
          }
        }
      ]
    });

    await alert.present();
  }
}