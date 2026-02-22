import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Game } from '@app/core/classes/game/game';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { GamePanelComponent } from '@app/shared/components/game-panel/game-panel.component';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';

type DetailType = 'difficulties' | 'interests' | 'durations' | 'ratings';

@Component({
    selector: 'app-paginator',
    templateUrl: './paginator.component.html',
    styleUrls: ['./paginator.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, GamePanelComponent, CommonModule, FormsModule, TranslateModule, LocalizedFieldPipe],
})
export class PaginatorComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @Input() inAdminVue: boolean = false;

    sortBy: string = '';
    selectedCategory: string = '';
    selectedType: DetailType = 'difficulties';

    tempSortBy: string = '';
    tempSelectedCategory: string = '';
    tempSelectedType: DetailType = 'difficulties';

    categories: { [key in DetailType]: string[] } = {
        difficulties: [],
        interests: [],
        durations: [],
        ratings: [],
    };
    categoryKeys: { [key in DetailType]: string[] } = {
        difficulties: [],
        interests: [],
        durations: [],
        ratings: [],
    };

    @ViewChild('filtrationDialog') filtrationDialog: any;

    nbGames: number = 0;
    filteredGames: { game: Game; categoryDetail: string; weightedRating: number }[] = [];
    dataSource = new MatTableDataSource<{ game: Game; categoryDetail: string; weightedRating: number }>();
    gamesUpdatedSubscription: Subscription;


    constructor(
        public gameService: GameServiceService,
        private dialog: MatDialog,
        public accountService: AccountService,
        public translateService: TranslateService,
    ) {}
    ngOnDestroy(): void {
        if (!this.gamesUpdatedSubscription?.closed) {
            this.gamesUpdatedSubscription?.unsubscribe();
        }
    }

    ngOnInit(): void {
        this.initializeTranslations();

        // Recharger les traductions si la langue change
        this.translateService.onLangChange.subscribe(() => {
            this.initializeTranslations();
        });

        this.loadGames();
        this.gamesUpdatedSubscription = this.gameService.gamesUpdated$.subscribe(() => {
            console.log("update")
            this.loadGames();
        })
    }

    ngAfterViewInit(): void {
        this.initializePaginatorLabels();

        // Mettre à jour les labels du paginator si la langue change
        this.translateService.onLangChange.subscribe(() => {
            this.initializePaginatorLabels();
        });
    }

    initializeTranslations(): void {
        // Charger les traductions visibles
        this.categories = {
            difficulties: this.translateService.instant('categories.difficulties'),
            interests: this.translateService.instant('categories.interests'),
            durations: this.translateService.instant('categories.durations'),
            ratings: this.translateService.instant('categories.ratings'),
        };

        // Charger les clés originales depuis les traductions (simuler le français)
        this.categoryKeys = {
            difficulties: ['facile', 'moyenne', 'difficile'],
            interests: ['intéressant', 'ennuyant'],
            durations: ['court', 'long'],
            ratings: ['1', '2', '3', '4'],
        };

        // Définir la catégorie sélectionnée par défaut (visible)
        this.selectedCategory = this.categories[this.selectedType][0];
    }

    initializePaginatorLabels(): void {
        if (this.paginator) {
            this.paginator._intl.itemsPerPageLabel = this.translateService.instant('paginator.itemsPerPage');
            this.paginator._intl.nextPageLabel = this.translateService.instant('paginator.nextPage');
            this.paginator._intl.previousPageLabel = this.translateService.instant('paginator.previousPage');
            this.paginator._intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
                if (length === 0 || pageSize === 0) {
                    return this.translateService.instant('paginator.rangeEmpty', { length });
                }

                const startIndex = page * pageSize;
                const endIndex = Math.min(startIndex + pageSize, length);

                return this.translateService.instant('paginator.range', { start: startIndex + 1, end: endIndex, length });
            };
        }
    }

    loadGames(callback?: () => void): void {
        this.gameService.getGameList().subscribe((games) => {
            games = games.filter((game) => game.isVisible || game.creator === this.accountService.account.userId);
            this.filteredGames = this.applyFilterAndSort(games);
            this.updateVisibleGamesCount(games);
            this.updatePageData(0, this.paginator?.pageSize || 4);

            if (callback) {
                callback();
            }
        });
    }

    onPageChange(event: PageEvent): void {
        this.loadGames(() => {
            this.updatePageData(event.pageIndex, event.pageSize);
        });
    }

    onSortChange(): void {
        this.filteredGames = this.applyFilterAndSort(this.filteredGames.map((fg) => fg.game));
        this.updatePageData(0, this.paginator?.pageSize || 4);
    }

    updatePageData(pageIndex: number, pageSize: number): void {
        const startIndex = pageIndex * pageSize;
        const endIndex = startIndex + pageSize;

        this.dataSource.data = this.filteredGames.slice(startIndex, endIndex);
    }

    applyFilterAndSort(games: Game[]): { game: Game; categoryDetail: string; weightedRating: number }[] {
        const extendedGames = games.map((game) => ({
            game,
            difficulties: game.difficultyMap || [],
            interests: game.interestMap || [],
            durations: game.durationMap || [],
            ratings: game.rating || [],
        }));

        return extendedGames
            .map(({ game, difficulties, interests, durations, ratings }) => {
                const selectedDetails =
                    this.selectedType === 'difficulties'
                        ? difficulties
                        : this.selectedType === 'interests'
                        ? interests
                        : this.selectedType === 'durations'
                        ? durations
                        : [];

                const selectedIndex = this.categories[this.selectedType].indexOf(this.selectedCategory);
                const originalCategory = this.categoryKeys[this.selectedType][selectedIndex];

                const categoryDetailObj = selectedDetails.find((detail) => detail.key.toLowerCase() === originalCategory.toLowerCase());

                const categoryDetail = categoryDetailObj ? `${this.selectedCategory}: ${categoryDetailObj.value}` : 'N/A';

                const weightedRating = this.calculateWeightedAverage(ratings);

                return {
                    game,
                    categoryDetail,
                    weightedRating,
                };
            })
            .sort((a, b) => {
                if (this.sortBy === 'rating') {
                    return b.weightedRating - a.weightedRating;
                } else {
                    const valueA = parseInt(a.categoryDetail.split(': ')[1] || '0', 10);
                    const valueB = parseInt(b.categoryDetail.split(': ')[1] || '0', 10);
                    return valueB - valueA;
                }
            });
    }

    calculateWeightedAverage(ratings: { key: string; value: number }[]): number {
        let weightedSum = 0;
        let totalWeight = 0;

        ratings.forEach((rating) => {
            const weight = parseInt(rating.key, 10);
            weightedSum += weight * rating.value;
            totalWeight += rating.value;
        });

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    updateVisibleGamesCount(games: Game[]): void {

        games = games.filter((game) => game.isVisible || game.creator === this.accountService.account.userId);
        this.nbGames = games.length;
    }

    navigatePreview(id: string): void {
        this.gameService.verifyGameIsAvailable(id, `create/preview/games/${id}`);
    }

    openFilterDialog(): void {
        this.tempSortBy = this.sortBy;
        this.tempSelectedType = this.selectedType;
        this.tempSelectedCategory = this.selectedCategory;

        const dialogRef = this.dialog.open(this.filtrationDialog, {
            width: '400px',
            disableClose: true,
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'apply') {
                this.applyFilters();
            }
        });
    }

    applyFilters(): void {
        this.sortBy = this.tempSortBy;
        this.selectedType = this.tempSelectedType;
        this.selectedCategory = this.tempSelectedCategory;

        this.filteredGames = this.applyFilterAndSort(this.filteredGames.map((fg) => fg.game));

        if (this.paginator) {
            this.paginator.pageIndex = 0;
        }

        this.updatePageData(0, this.paginator?.pageSize || 4);
    }

    clearAllFilters(): void {
        this.sortBy = '';
        this.selectedType = 'difficulties';
        this.selectedCategory = this.categories.difficulties[0];

        if (this.paginator) {
            this.paginator.pageIndex = 0;
        }

        this.loadGames();
    }

    isFilterApplied(): boolean {
        return this.sortBy !== '';
    }
}
