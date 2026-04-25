import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { BootScene } from './scenes/BootScene';
import { DeathScene } from './scenes/DeathScene';
import { AUTO, Scale, Game } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        TitleScene,
        GameScene,
        DeathScene
    ]
};

const StartGame = (parent) => {
    return new Game({ ...config, parent });
}

export default StartGame;
