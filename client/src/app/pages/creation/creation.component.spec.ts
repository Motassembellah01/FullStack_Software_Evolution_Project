/* eslint-disable no-underscore-dangle */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCardModule } from '@angular/material/card';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { PaginatorComponent } from '@app/shared/components/paginator/paginator.component';
import { CreationComponent } from './creation.component';
import { CommonModule } from '@angular/common';

describe('CreationComponent', () => {
    let component: CreationComponent;
    let fixture: ComponentFixture<CreationComponent>;
    let gameServiceSpy: jasmine.SpyObj<GameServiceService>;

    beforeEach(() => {
        gameServiceSpy = jasmine.createSpyObj('GameServiceService', [
            'importGame',
            'getGameList',
            'validateName',
            'importGame',
            'validateOtherAttributes',
            'resetCurrentGame',
            'displayErrors',
            'validateAttributesTypes',
            'gamesUpdated$',
        ]);
        TestBed.configureTestingModule({
            declarations: [],
            imports: [BrowserAnimationsModule, MatCardModule, CreationComponent, PaginatorComponent, CommonModule],
            providers: [
                { provide: GameServiceService, useValue: gameServiceSpy },
                { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'testID' } } } },
            ],
        });
        fixture = TestBed.createComponent(CreationComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
