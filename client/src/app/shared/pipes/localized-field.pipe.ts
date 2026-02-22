import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
    name: 'localizedField',
    standalone: true,
    pure: false,
})
export class LocalizedFieldPipe implements PipeTransform {
    constructor(private translateService: TranslateService) {}

    transform(obj: any, field: string): string {
        if (!obj) return '';
        const lang = this.translateService.currentLang;
        if (lang === 'en') {
            const enKey = `${field}En`;
            if (obj[enKey]) return obj[enKey];
        }
        return obj[field] ?? '';
    }
}
