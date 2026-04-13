import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'; // Tambah CUSTOM_ELEMENTS_SCHEMA
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { UserDetailPageRoutingModule } from './user-detail-routing.module';
import { UserDetailPage } from './user-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserDetailPageRoutingModule,
  ],
  declarations: [UserDetailPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // <--- Tambahkan baris ini
})
export class UserDetailPageModule {}