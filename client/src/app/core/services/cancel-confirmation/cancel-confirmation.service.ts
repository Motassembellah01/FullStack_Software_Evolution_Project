import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DIALOG } from '@app/core/constants/constants';
import { ConfirmationComponentComponent } from '@app/shared/components/confirmation-component/confirmation-component.component';

/** Service that manages the display of the confirmation dialog and the execution of corresponding
 * functions depending of the user action
 * */
@Injectable({
    providedIn: 'root',
})
export class CancelConfirmationService {
    userConfirmed: boolean = false;
    dialogRef: MatDialogRef<ConfirmationComponentComponent>;
    dialogMessage: string;
    constructor(private dialog: MatDialog) {}

    askConfirmation(action: () => void, message: string = ''): void {
        this.dialogMessage = message;
        this.dialogRef = this.dialog.open(ConfirmationComponentComponent, {
            width: DIALOG.confirmationWidth,
            height: DIALOG.confirmationHeight,
            disableClose: true,
            panelClass: 'confirmation-dialog-panel',
        });
        this.dialogRef.componentInstance.confirmationService = this;
        this.dialogRef.afterClosed().subscribe(() => {
            if (this.userConfirmed) action();
        });
    }
}
