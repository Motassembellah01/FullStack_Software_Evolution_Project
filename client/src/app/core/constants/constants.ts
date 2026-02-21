export const HTTP_RESPONSES: { [key: string]: number } = {
    ok: 200,
    created: 201,
    noContent: 204,
    badRequest: 400,
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
    internalServerError: 500,
};

export const POINTS = {
    min: 10,
    max: 100,
    increment: 10,
};

export const MAX_PLAYER_NAME_LENGTH = 10;

export const MAX_ACCESS_CODE_LENGTH = 4;

export const QRL_TIME = 60;

export const QCM_TIME = {
    min: 10,
    max: 60,
};

export const CHOICES = {
    min: 2,
    max: 4,
};

export const MAX_PANIC_TIME_FOR = {
    qcm: 10,
    qrl: 20,
};

export const ERROR_MESSAGE_FOR_FR = {
    name: 'Un nom est requis',
    nameType: 'Un nom en format texte est requis',
    existingName: 'Le nom choisi existe déjà',
    description: 'Une description est requise',
    descriptionType: 'Une description en format texte est requise',
    qcmTime: 'Le temps des QCM doit être compris entre 10 et 60 secondes',
    qcmTimeType: 'Un nombre pour le temps de QCM est requis',
    questions: 'Le jeu doit comporter au moins une question valide',
    questionsType: 'Un tableau de questions est requis',
};

export const ERROR_MESSAGE_FOR_EN = {
    name: 'A name is required',
    nameType: 'A name in text format is required',
    existingName: 'The chosen name already exists',
    description: 'A description is required',
    descriptionType: 'A description in text format is required',
    qcmTime: 'The time for the QCM must be between 10 and 60 seconds',
    qcmTimeType: 'A number for the QCM time is required',
    questions: 'The game must have at least one valid question',
    questionType: 'A table of questions is required',
};

export const ERROR_TITLE_FR = {
    createGame: "L'enregistrement du jeu a échoué à cause des erreurs suivantes :",
}

export const ERROR_TITLE_EN = {
    createGame: "L'enregistrement du jeu a échoué à cause des erreurs suivantes :",
}


export const DIALOG = {
    questionFormWidth: '80%',
    newNameWidth: '40%',
    transitionWidth: '45rem',
    transitionHeight: '18rem',
    endMatchTransitionWidth: '55rem',
    endMatchTransitionHeight: '24rem',
    confirmationWidth: '40rem',
    confirmationHeight: '15rem',
};

export const DIALOG_MESSAGE_FR = {
    cancelQuestion: 'annuler la création de la question',
    gameDeletion: 'supprimer ce jeu',
    cancelQuestionModification: 'annuler les modification à cette question',
    cancelChoiceDeletion: 'supprimer ce choix de réponse',
    cancelGameCreation: 'annuler la création de ce jeu',
    cancelModifyGame: 'annuler la modification de ce jeu',
    cancelMatch: 'annuler cette partie',
    finishMatch: 'terminer cette partie',
    quitMatch: 'quitter cette partie',
    clearHistory: "effacer l'historique des parties",
};

export const DIALOG_MESSAGE_EN = {
    cancelQuestion: 'cancel question creation',
    gameDeletion: 'delete this game',
    cancelQuestionModification: 'undo edits to this question',
    cancelChoiceDeletion: 'remove this answer choice',
    cancelGameCreation: 'cancel the creation of this game',
    cancelModifyGame: 'undo edit this game',
    cancelMatch: 'cancel this match',
    finishMatch: 'finish this match',
    quitMatch: 'quit this match',
    clearHistory: 'clear game history',
};

export const SNACKBAR_DURATION = 4000;

export const SNACKBAR_MESSAGE_FR = {
    gameImported: 'Jeu importé avec succès',
    gameCreated: 'Jeu créé avec succès',
    gameUpdated: 'Jeu modifié avec succès',
    minQuestionNumber: 'La partie doit avoir au moins 2 questions',
};

export const SNACKBAR_MESSAGE_EN = {
    gameImported: 'Game imported successfully',
    gameCreated: 'Game created successfully',
    gameUpdated: 'Game modified successfully',
    minQuestionNumber: 'The game must have at least 2 questions',
};

export const LENGTHS = {
    questionId: 9,
    gameId: 8,
    accessCode: 4,
};

export const FACTORS = {
    ascendingSort: 1,
    descendingSort: -1,
    firstChoice: 1.2,
    timeProgressSpinner: 20,
    percentage: 100,
    tolerancePercentage: 0.25,
};

export const DURATIONS = {
    bonusMessage: 2500,
    backToMatch: 1000,
    timerInterval: 1000,
    panicModeInterval: 250,
    notifyChatAccessibility: 3500,
    qrlHistogramUpdateInterval: 5,
};

export const ERRORS = {
    noIndexFound: -1,
};

export const CHAR_SETS = {
    accessCode: '0123456789',
    id: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
};

export const NAMES = {
    manager: 'Organisateur',
    tester: 'Testeur',
    system: 'Système',
};

export const PLAYERS_NAME_COLORS = {
    red: 'red',
    yellow: '#FFD700',
    green: 'green',
    black: 'black',
};

export const TRANSITIONS_DURATIONS = {
    startOfTheGame: 5,
    betweenQuestions: 3,
    endMatchAfterPlayersLeft: 5,
};

export const MONEY = {
    priceAvatars: 50,
    priceThemes: 100,
    priceWin: 100,
    priceLose: 10,
    priceEntry: 10
};

export const FEEDBACK_MESSAGES_FR = {
    sameScore: 'Votre score reste inchangé',
    wrongAnswer: "vous n'avez malheureusement pas eu la bonne réponse",
    rightAnswer: 'vous avez eu la bonne réponse!',
    halfPoints: 'vous avez eu la moitié des points!',
    bonus: 'Vous êtes le/la premier/ère à avoir la bonne réponse! +20% bonus',
    chatBlocked: 'Vous ne pouvez plus envoyer des messages pour le moment',
    chatUnblocked: 'Vous pouvez à nouveau envoyer des messages',
    playerLeftMatch: 'a quitté la partie',
    pointsAddedToScore: "points s'ajoutent à votre score!",
    waiting: 'veuillez patienter',
    duringEvaluation: 'Évaluation de la question en cours',
};

export const FEEDBACK_MESSAGES_EN = {
    sameScore: 'Your score remains unchanged',
    wrongAnswer: "unfortunately you didn't get the right answer",
    rightAnswer: 'you got the right answer!',
    halfPoints: 'you got half the points',
    bonus: 'You are the first to have the correct answer! +20% bonus',
    chatBlocked: 'You can no longer send messages at this time',
    chatUnblocked: 'You can send messages again',
    playerLeftMatch: 'left the game',
    pointsAddedToScore: 'points are added to your score!',
    waiting: 'please wait',
    duringEvaluation: 'Evaluation of the current question',
};

export const TRANSITIONS_MESSAGES_FR = {
    beginMatch: 'La partie commence dans',
    transitionToResultsView: 'Présentation des résultats dans',
    transitionToNextQuestion: 'Prochaine question dans',
    nextQuestionTestView: 'Prochaine question',
    matchEndTestView: 'Fin de la partie',
    endMatchAfterPlayersLeft: "Tous les joueurs ont quitté la partie, vous serez dirigé vers la page d'accueil dans",
};

export const TRANSITIONS_MESSAGES_EN = {
    beginMatch: 'The match begins in ',
    transitionToResultsView: 'Presentation of results in ',
    transitionToNextQuestion: 'Next question in ',
    nextQuestionTestView: 'Next question',
    matchEndTestView: 'End of the game',
    endMatchAfterPlayersLeft: 'All players have left the game, you will be taken to the home page in ',
};

export const HISTOGRAM_TEXTS = {
    playersInteract: 'Ont interagi',
    playersInteraction: 'Interactions des joueurs',
    playersDidNotInteract: "N'ont pas interagi",
    percentages: 'Pourcentages attribués',
    answersChoices: 'Choix de réponse',
    playersNumber: 'Nombre de joueurs',
    players: 'Joueurs',
};

export const QUESTION_TYPE = {
    qcm: 'QCM',
    qrl: 'QRL',
    qre: 'QRE',
};

export const CHART_COLOR = {
    qcm: '#F9CBA8',
    qrl: '#4682B4',
};

export enum SocketsSendEvents {
    JoinMatch = 'joinMatchRoom',
    JoinMatchObserver = 'joinMatchObserver',
    SendMessage = 'sendMessage',
    SwitchQuestion = 'switchQuestion',
    UpdateAnswer = 'updateAnswer',
    StartTimer = 'startTimer',
    StopTimer = 'stopTimer',
    CancelGame = 'cancelGame',
    FinishMatch = 'finishMatch',
    BeginMatch = 'beginMatch',
    RemovePlayer = 'removePlayer',
    UpdateScore = 'updatePlayerScore',
    SetFinalAnswer = 'setFinalAnswer',
    PlayerLeftAfterMatchBegun = 'playerLeftAfterMatchBegun',
    SendChartData = 'sendChartData',
    BeginQrlEvaluation = 'beginQrlEvaluation',
    FinishQrlEvaluation = 'finishQrlEvaluation',
    PanicModeActivated = 'panicModeActivated',
    ChangeChatAccessibility = 'changeChatAccessibility',
    HistogramTime = 'histogramTime',
    CreateTeam = 'createTeam',
    JoinTeam = 'joinTeam',
    QuitTeam = 'quitTeam',
    RemoveObserver = 'removeObserver',
    UpdateMoney = 'updateMoney',
    GameEvaluation = 'gameEvaluation',
}

export enum SocketsOnEvents {
    NewPlayer = 'newPlayer',
    JoinedMatchObserver = 'joinedMatchObserver',
    ChatMessage = 'chatMessage',
    NextQuestion = 'nextQuestion',
    AnswerUpdated = 'answerUpdated',
    NewTime = 'newTime',
    GameCanceled = 'gameCanceled',
    MatchFinished = 'matchFinished',
    JoinBegunMatch = 'joinMatch',
    PlayerRemoved = 'playerRemoved',
    UpdatedScore = 'updatedPlayerScore',
    FinalAnswerSet = 'finalAnswerSet',
    PlayerDisabled = 'playerDisabled',
    AllPlayersResponded = 'allPlayersResponded',
    UpdateChartDataList = 'updateChartDataList',
    QrlEvaluationBegun = 'qrlEvaluationBegun',
    QrlEvaluationFinished = 'qrlEvaluationFinished',
    PanicModeActivated = 'panicModeActivated',
    ChatAccessibilityChanged = 'chatAccessibilityChanged',
    HistogramTime = 'histogramTime',
    TeamCreated = 'teamCreated',
    TeamJoined = 'teamJoined',
    TeamQuit = 'teamQuit',
    ObserverRemoved = 'observerRemoved',
    UpdateMoney = 'updateMoney',
    SendWinnerName = 'sendWinnerName',
}

export enum ChatSocketsEmitEvents {
    CreateChatRoom = 'generalCreateChatRoom',
    DeleteChatRoom = 'generalDeleteChatRoom',
    JoinChatRoom = 'generalJoinChatRoom',
    LeaveChatRoom = 'generalLeaveChatRoom',
    SendMessage = 'generalSendMessage',
    GetOldMessages = 'generalGetOldMessages',
    GetChannels = 'generalGetChannels',
    UserInfo = 'userInfo',
}

export enum ChatSocketsSubscribeEvents {
    NewChatRoom = 'generalNewChatRoom',
    ChatClosed = 'generalChatClosed',
    ChatJoined = 'generalChatJoined',
    ChatLeft = 'generalChatLeft',
    ChatMessage = 'generalChatMessage',
    SendOldMessages = 'generalSendOldMessages',
    ChatRoomList = 'generalChatRoomList',
}

export enum ChatRoomType {
    General = 'general',
    Public = 'public',
    Match = 'match',
}

export enum ThemeVisual {
    DARK = 'dark',
    LIGHT = 'light',
    CHRISTMAS = 'christmas',
    VALENTINES = 'valentines'
}

export enum Language {
    EN = 'en',
    FR = 'fr',
}

export const ERROR_QUESTION_FR = {
    save: "L'enregistrement de la question a échoué à cause des erreurs suivantes : ",
    points: '\n- Les points accordés à la question doivent être entre 10 et 100 points',
    statement: "\n- L'énoncé de la question est requis",
    type: "\n- Le type de la question n'a pas été choisi",
    allChoices: "\n- Le texte d'un ou plusieurs choix de réponse n'a pas été saisi",
    uniqueChoice: '\n- Chaque choix de réponse doit contenir une réponse unique',
    correctChoice: '\n- La question doit avoir au moins une bonne réponse parmi les choix',
    wrongChoice: '\n- La question doit avoir au moins une mauvaise réponse parmi les choix',
    choices: '\n- La question doit contenir des choix de réponse',
    tolerance: '\n- La tolérance ne doit pas dépasser 25% de l’intervalle',
    lowerBound: '\n- La limite inférieure doit être inférieure ou égale à la bonne réponse',
    upperBound: '\n- La limite supérieure doit être supérieure ou égale à la bonne réponse',
    allResponses: '\n- Tous les champs de la QRE doivent être remplis',
};

export const ERROR_QUESTION_EN = {
    save: 'Saving the question failed due to the following errors:',
    points: '\n- The points assigned to the question must be between 10 and 100 points',
    statement: '\n- The question statement is required',
    type: '\n- The question type has not been selected',
    allChoices: '\n- The text for one or more answer choices has not been provided',
    uniqueChoice: '\n- Each answer choice must contain a unique response',
    correctChoice: '\n- The question must have at least one correct answer among the choices',
    wrongChoice: '\n- The question must have at least one incorrect answer among the choices',
    choices: '\n- The question must include answer choices',
    tolerance: '\n- The tolerance must not exceed 25% of the range',
    lowerBound: '\n- The lower bound must be less than or equal to the correct answer',
    upperBound: '\n- The upper bound must be greater than or equal to the correct answer',
    allResponses: '\n- All fields for the QRE must be filled',
};

export const FRIENDS_FR = {
    discover: 'Découvrir',
    friends: 'Amis',
    friendRequest: 'Demandes',
    blocked: 'Bloqués',
}

export const FRIENDS_EN = {
    discover: 'Discover',
    friends: 'Friends',
    friendRequest: 'Requests',
    blocked: 'Blocked',
}