import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, docData, collection, query, where, collectionData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { NavController } from '@ionic/angular';
import { Observable, of, combineLatest, switchMap, filter } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-profile-view',
  templateUrl: './profile-view.page.html',
  styleUrls: ['./profile-view.page.scss'],
  standalone: false,
})
export class ProfileViewPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);

  partnerId: string = '';
  profileData$: Observable<any> = of(null);

  ngOnInit() {
    // Logika Refresh: Paksa ke Home
    const perfEntries = performance.getEntriesByType("navigation")[0] as any;
    if (perfEntries && perfEntries.type === "reload") {
      this.navCtrl.navigateRoot('/home');
      return; 
    }

    this.partnerId = this.route.snapshot.queryParams['id'];

    if (!this.partnerId) {
      this.navCtrl.navigateRoot('/home');
      return;
    }

    this.profileData$ = authState(this.auth).pipe(
      filter(user => !!user),
      switchMap(currentUser => {
        const currentUid = currentUser.uid;
        const userRef = doc(this.firestore, `users/${this.partnerId}`);
        const userObs = docData(userRef);

        const swapCollect = collection(this.firestore, 'swaps');
        const q = query(
          swapCollect, 
          where('fromUid', 'in', [currentUid, this.partnerId]),
          where('toUid', 'in', [currentUid, this.partnerId])
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

  // Fungsi Back yang dipaksa ke root home
  goBack() {
    this.navCtrl.navigateRoot('/home', { animated: true, animationDirection: 'back' });
  }
}