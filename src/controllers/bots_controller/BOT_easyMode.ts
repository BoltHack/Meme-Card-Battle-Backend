import { Socket } from "socket.io";

function getRandomNumber() {
    return Number(Math.floor(Math.random() * 2));
}

const handCards = {
    0: [
        { id: 1, power: 2, rarity: 'default' },
        { id: 2, power: 6, rarity: 'rare' },
        { id: 3, power: 10, rarity: 'strong' }
    ],
    1: [
        { id: 4, power: 5, rarity: 'default' },
        { id: 5, power: 15, rarity: 'strong' },
        { id: 6, power: 8, rarity: 'rare' }
    ],
}


export const BOT_mode = (socket: Socket) => {
    let answer = '';
    console.log(`Пользователь ${socket.id} активировал бота.`);

    socket.on('bot_getAnswer', (data) => {
        const { playerCard } = data;
        try {
            console.log('loading...');
            const currentLayoutIndex = getRandomNumber();
            const botHand = [...handCards[currentLayoutIndex]];

            console.log('Игрок походил:', playerCard);

            const decisions = botHand.map((card, index) => {
                let winScore = card.power > playerCard ? (card.power - playerCard) : 0;
                if (winScore === 0) return { index, score: 0, card };
                let greedScore = 1.1 - (card.power / 100);
                let rarityMultiplier = card.rarity === 'strong' ? 0.4 : 1;
                let totalScore = winScore * greedScore * rarityMultiplier;

                return { index, score: totalScore, card };
            });

            decisions.sort((a, b) => b.score - a.score);
            const bestMove = decisions[0];

            if (bestMove && bestMove.score > 0) {
                answer = `Вы кинули: ${playerCard}\n\nБот бьет картой: ${bestMove.card.power} (id: ${bestMove.card.id} | ${bestMove.card.rarity})`;
                socket.emit('bot_answer', { answer: answer });
            } else {
                answer = `Вы кинули: ${playerCard}\n\nБот пасует / берет карту`;
                socket.emit('bot_answer', { answer: answer });
            }
        } catch (err) {
            console.error('Ошибка:', err);
        }
    });
};