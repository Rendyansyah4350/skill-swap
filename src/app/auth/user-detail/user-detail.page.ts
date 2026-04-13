import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  getDoc 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth'; 
import { Observable, Subscription } from 'rxjs';
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

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('id');
    
    if (userId) {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      this.user$ = docData(userDocRef);
      
      this.userSub = this.user$.subscribe(data => {
        if (data) {
          this.targetUser = data;
          console.log("Data user target siap:", data.fullName);
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  async sendSwapRequest() {
    if (this.auth.currentUser?.uid === this.targetUser?.uid) {
      this.showToast("Masa mau barter sama diri sendiri, bang? :D", "warning");
      return;
    }

    if (!this.targetUser || !this.targetUser.skillsOffered) {
      this.showToast("Data user belum siap atau skill kosong.", "danger");
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Pilih Skill',
      message: `Pilih skill yang mau kamu pelajari dari ${this.targetUser.fullName}:`,
      inputs: this.targetUser.skillsOffered.map((skill: string) => ({
        label: skill,
        type: 'checkbox',
        value: skill,
        name: 'selectedSkills'
      })),
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Kirim Ajakan',
          handler: (selectedSkills: string[]) => {
            if (selectedSkills && selectedSkills.length > 0) {
              this.saveToFirestore(selectedSkills);
            } else {
              this.showToast('Pilih minimal satu skill dulu ya!', 'warning');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async saveToFirestore(skillNames: string[]) {
    try {
      const swapCollect = collection(this.firestore, 'swaps');
      const myUid = this.auth.currentUser?.uid;
      
      if (!myUid) return;

      // --- PERBAIKAN DI SINI: Ambil nama dari Firestore users, bukan dari Auth ---
      const myDocRef = doc(this.firestore, `users/${myUid}`);
      const myDocSnap = await getDoc(myDocRef);
      const myFullName = myDocSnap.exists() ? myDocSnap.data()['fullName'] : 'User';
      
      let countSuccess = 0;
      let countDuplicate = 0;

      await Promise.all(skillNames.map(async (skillName) => {
        const q = query(
          swapCollect,
          where('fromUid', '==', myUid),
          where('toUid', '==', this.targetUser.uid),
          where('requestedSkill', '==', skillName)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await addDoc(swapCollect, {
            fromUid: myUid,
            fromName: myFullName, // Nama asli abang sekarang tersimpan!
            toUid: this.targetUser.uid,
            toName: this.targetUser.fullName,
            requestedSkill: skillName,
            status: 'pending',
            createdAt: serverTimestamp()
          });
          countSuccess++;
        } else {
          countDuplicate++;
        }
      }));

      if (countSuccess > 0) {
        this.showToast(`${countSuccess} ajakan berhasil dikirim!`, 'success');
      }
      if (countDuplicate > 0) {
        this.showToast(`${countDuplicate} skill sudah pernah diajukan sebelumnya.`, 'warning');
      }

    } catch (error) {
      console.error(error);
      this.showToast('Waduh, gagal kirim request nih.', 'danger');
    }
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