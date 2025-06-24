import { Card } from "./cards.model";

export interface Participant {
  id: string;
  name: string;
  selectedCard?: Card;
  isRevealed: boolean;
}
