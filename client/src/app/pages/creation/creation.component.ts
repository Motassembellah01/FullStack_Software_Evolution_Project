import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppMaterialModule } from '@app/modules/material.module';
import { PaginatorComponent } from '@app/shared/components/paginator/paginator.component';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AccountService } from '@app/core/http/services/account-service/account.service';

@Component({
    selector: 'app-creation',
    templateUrl: './creation.component.html',
    styleUrls: ['./creation.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, PaginatorComponent, RouterModule, TranslateModule, CommonModule],
})
export class CreationComponent {
    constructor(public accountService: AccountService) {}
}
