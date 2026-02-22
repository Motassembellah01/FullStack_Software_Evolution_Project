import { Question } from '@app/classes/question/question';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema({ collection: 'game' })
export class Game {
    @ApiProperty()
    @Prop({ required: true })
    id: string;

    @ApiProperty()
    @Prop({ required: true })
    title: string;

    @ApiProperty()
    @Prop()
    titleEn?: string;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty()
    @Prop()
    descriptionEn?: string;

    @ApiProperty()
    @Prop({ required: true })
    duration: number;

    @ApiProperty()
    @Prop({ required: true })
    lastModification: string;

    @ApiProperty()
    @Prop({ required: true })
    questions: Question[];

    @ApiProperty()
    @Prop({ required: true })
    isVisible: boolean;

    @ApiProperty()
    @Prop({ required: true })
    creator: string;

    @ApiProperty()
    _id?: string;

    @ApiProperty()
    @Prop({ required: true })
    difficultyMap: {key: string, value: number}[];

    @ApiProperty()
    @Prop({ required: true })
    interestMap: {key: string, value: number}[];

    @ApiProperty()
    @Prop({ required: true })
    durationMap: {key: string, value: number}[];

    @ApiProperty()
    @Prop({ required: true })
    rating: {key: string, value: number}[];
}

export const gameSchema = SchemaFactory.createForClass(Game);
