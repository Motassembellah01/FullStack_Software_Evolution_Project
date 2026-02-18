import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DURATIONS, SocketsOnEvents, SocketsSendEvents } from '@app/core/constants/constants';
import { StopServerTimerRequest } from '@app/core/interfaces/stop-server-timer-request';
import { TimerRequest } from '@app/core/interfaces/timer-request';
import { ServerConfigService } from '@app/core/services/server-config/server-config.service';
import { JoinMatchService } from '@app/core/services/join-match/join-match.service';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { Observable } from 'rxjs';

type TimerCallback = () => void;
/**
 * This class allows to centralize the timers management.
 */
@Injectable({
    providedIn: 'root',
})
export class TimeService {
    private counter: number = 0;
    constructor(
        public socketService: SocketService,
        public joinMatchService: JoinMatchService,
        private readonly http: HttpClient,
        private readonly serverConfig: ServerConfigService,
    ) {}

    get timer(): number {
        return this.counter;
    }

    set timer(counter: number) {
        if (counter === 0) this.stopTimer();
        else this.counter = counter;
    }

    /**
     * action parameter is a function that is going to be called when the time finish.
     */
    startTimer(startValue: number, matchAccessCode: string, finalAction: TimerCallback): void {
        if (!this.joinMatchService.playerName) {
            this.socketService.send<TimerRequest>(SocketsSendEvents.StartTimer, {
                roomId: matchAccessCode,
                timer: startValue,
                timeInterval: DURATIONS.timerInterval,
            });
        }
        this.counter = startValue;
        this.socketService.on<TimerRequest>(SocketsOnEvents.NewTime, (timerRequest: TimerRequest) => {
            this.counter = timerRequest.timer;
            if (timerRequest.timer < 1) {
                this.counter = 0;
                this.socketService.removeListener(SocketsOnEvents.NewTime);
                finalAction();
            }
        });
    }

    setUpTimer(onAction: Function, finalAction: TimerCallback) {
        this.socketService.removeListener(SocketsOnEvents.NewTime);
        this.socketService.on<TimerRequest>(SocketsOnEvents.NewTime, (timerRequest: TimerRequest) => {
            onAction();
            this.counter = timerRequest.timer;
            if (timerRequest.timer < 1) {
                this.counter = 0;
                this.socketService.removeListener(SocketsOnEvents.NewTime);
                finalAction();
            }
        });
    }

    startHistogramTimer(matchAccessCode: string, action: TimerCallback): void {
        this.socketService.send<TimerRequest>(SocketsSendEvents.HistogramTime, {
            roomId: matchAccessCode,
            timer: 0,
            timeInterval: DURATIONS.timerInterval,
        });

        this.socketService.on<TimerRequest>(SocketsOnEvents.HistogramTime, (timerRequest: TimerRequest) => {
            if (timerRequest.timer === DURATIONS.qrlHistogramUpdateInterval) action();
        });
    }

    startPanicModeTimer(matchAccessCode: string): void {
        if (!this.joinMatchService.playerName) {
            this.socketService.send<TimerRequest>(SocketsSendEvents.StartTimer, {
                roomId: matchAccessCode,
                timer: this.counter,
                timeInterval: DURATIONS.panicModeInterval,
            });
        }
    }

    stopServerTimer(matchAccessCode: string, isHistogramTimer: boolean = false): void {
        this.socketService.send<StopServerTimerRequest>(SocketsSendEvents.StopTimer, {
            roomId: matchAccessCode,
            isHistogramTimer,
        });
    }

    stopTimer(): void {
        this.counter = 0;
        this.socketService.removeListener(SocketsOnEvents.NewTime);
    }

    resumeTimer(matchAccessCode: string, action: TimerCallback): void {
        this.startTimer(this.counter, matchAccessCode, action);
    }

    getCurrentTime(): string {
        const currentTime = new Date();
        const hours = currentTime.getHours().toString().padStart(2, '0');
        const minutes = currentTime.getMinutes().toString().padStart(2, '0');
        const seconds = currentTime.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    getTimerByAccessCode(accessCode: string): Observable<any> {
        return this.http.get(`${this.serverConfig.serverUrl}/matches/timer/${accessCode}`);
    }
}
