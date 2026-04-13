import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, docData, collection, query, where, collectionData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
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
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  profileData$: Observable<any> = of(null);

  ngOnInit() {
    // Ambil ID dengan cara yang sama seperti user-detail agar konsisten
    // Mencoba paramMap dulu, kalau kosong baru queryParams
    const userId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParams['id'];

    if (userId) {
      this.profileData$ = authState(this.auth).pipe(
        filter(currUser => !!currUser),
        switchMap(currentUser => {
          const currentUid = currentUser.uid;
          
          // 1. Ambil Data Partner
          const userRef = doc(this.firestore, `users/${userId}`);
          const userObs = docData(userRef);

          // 2. Ambil Data Swaps
          const swapCollect = collection(this.firestore, 'swaps');
          const q = query(
            swapCollect, 
            where('fromUid', 'in', [currentUid, userId]),
            where('toUid', 'in', [currentUid, userId])
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
}