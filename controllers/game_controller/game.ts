// import { mongoose, Types } from "mongoose";
import { Socket } from "socket.io";
const mongoose = require('mongoose');

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import GamesModel from "../../models/GamesModel";

interface SocketData extends Socket {
    playerId?: string;
    gameId?: string;
}

interface UserData {
    _id: string;
    game_key: string;
    player_id: string;
}

interface UserMongooseData {
    isOnline: boolean;
    gameInfo: string;
    myCards: object;
}

export const GAME = async (socket: Socket) => {

    let isCardSelected = null;
    console.log(`Пользователь ${socket.id} подключился к игре.`);

    socket.on("join_game", async (data) => {
        const { game_key, player_id } = data;
        try {
            const game_info = await GamesModel.findOne({ game_key: game_key });
            if (!game_info) {
                console.log("Игра не найдена.");
                return;
            }
            const game_id = game_info._id as UserData;

            let updatedGame = await GamesModel.findOneAndUpdate(
                { _id: game_id },
                { $addToSet: { 'game_online.users': player_id } },
                { new: true }
            );

            if (!updatedGame) {
                console.log("Игра не найдена.");
                socket.emit("error", { message: "Игра не найдена" });
                return;
            }

            (socket as SocketData).playerId = player_id;
            (socket as SocketData).gameId = updatedGame._id.toString();

            console.log(`Игрок ${player_id} успешно добавлен в игру ${updatedGame._id}`);

            const playerRoom = `game:${player_id}`;
            socket.join(playerRoom);
        } catch (err) {
            console.log('err', err);
        }
    });

    async function get_cards_func(arr) {
        const ids = arr.map(c => c.card_id.toString());

        const player_cards = await CardsModel.find({ _id: { $in: ids } });

        const formattedCardsArray = player_cards.flatMap(card => {
            const isRandom = arr.find(c => c.card_id.toString() === card._id.toString());
            const count = isRandom.quantity || 1;

            // console.log('isRandom', isRandom);
            // console.log('card', card);

            return Array.from({ length: count }, (_, index) => ({
                menu_id: new mongoose.Types.ObjectId(),
                quantity: isRandom.quantity,
                id: isRandom.card_id,
                name: card.card_name,
                description: card.card_description || "",
                avatar: card.card_avatar,
                lvl: card.card_lvl_info?.lvl_number || 1,
                rarity: card.card_lvl_info?.lvl_name || "Default",
                damage: card.card_stats?.card_damage || 0,
                protection: card.card_stats?.card_protection || 0
            }));

        });

        // const formattedCardsArray = player_cards.map(cards => {
        //     const cardIdStr = cards._id.toString();
        //     const randomId = new mongoose.Types.ObjectId();
        //
        //     const isRandom = arr.find(c => c.card_id.toString() === cardIdStr.toString());
        //     // const isQuantity = arr.find(c => c.card_id.toString() === cardIdStr.toString() ? c.quantity : null);
        //     // console.log('isRandom', isRandom.quantity);
        //
        //     return {
        //         menu_id: randomId,
        //         quantity: isRandom.quantity,
        //         id: cards._id,
        //         name: cards.card_name,
        //         description: cards.card_description || "",
        //         avatar: cards.card_avatar,
        //         lvl: cards.card_lvl_info?.lvl_number || 1,
        //         rarity: cards.card_lvl_info?.lvl_name || "Default",
        //         damage: cards.card_stats?.card_damage || 0,
        //         protection: cards.card_stats?.card_protection || 0
        //     }
        // });

        socket.emit('get_player_cards', {
            cards_data: formattedCardsArray,
        });
    }

    socket.on("get_user_cards", async (data) => {
        const { player_id } = data;
        try {
            // const player_id = (socket as SocketData).playerId;

            const player_info = await UsersModel.findById(player_id);

            if (!player_info) return;

            const player_cards = player_info.myCards as UserMongooseData;

            await get_cards_func(player_cards);
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("check_battle_card", async (data) => {
        const { game_key, player_id, card_id, menu_id } = data;
        try {
            const game_info = await GamesModel.findOne({ game_key: game_key });
            const player_info = await UsersModel.findById(player_id);

            const playerIndex = game_info.users_battle_info.findIndex(p => p._id.toString() === player_id);
            const player_cards_length = game_info.users_battle_info[playerIndex].user_cards.battle_cards.length;

            console.log('player_cards_length', player_cards_length);
            if (player_cards_length >= 8) {
                console.log('Лимит карт достигнут.');
                socket.emit("error_handler", "Вы не можете набрать в колоду больше 8 карт.");
                return;
            }

            const user_card_entry = player_info.myCards.find(c => c.card_id?.toString() === card_id.toString());
            if (!user_card_entry) {
                return;
            }

            const battle_card = await CardsModel.findById(user_card_entry.card_id);

            if (!battle_card) {
                return;
            }

            const updatedGame = await GamesModel.findOneAndUpdate(
                {
                    _id: game_info._id,
                    "users_battle_info._id": player_id
                },
                {
                    $addToSet: {
                        'users_battle_info.$.user_cards.battle_cards': {
                            card_id: battle_card,
                            user_base_card_id: menu_id
                        }
                    }
                },
                { new: true }
            );

            if (!updatedGame) {
                console.log("Игра не найдена.");
                return;
            }

            socket.emit("select_battle_card", {
                card: battle_card,
                menu_id: menu_id
            });
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("clear_battle_cards", async (data) => {
        const { game_key, player_id } = data;
        try {
            const game_info = await GamesModel.findOne({ game_key: game_key });

            if (!game_info || !game_info.users_battle_info) {
                return socket.emit({ message: "Game session not found" });
            }

            const playerIndex = game_info.users_battle_info.findIndex(p => p._id.toString() === player_id);
            if (playerIndex === -1) {
                console.log("Игрок не найден в игре.");
                return;
            }

            game_info.users_battle_info[playerIndex].user_cards.battle_cards = [];
            game_info.save();
        } catch (err) {
            console.log('err', err);
        }
    })

    // socket.on("check_battle_cards", async (data) => {
    //     const { game_key, player_id } = data;
    //     try {
    //         // const player_info = await UsersModel.findById(player_id);
    //         const game_info = await GamesModel.findOne({ game_key: game_key });
    //
    //         if (!game_info || !game_info.users_battle_info) {
    //             return socket.emit({ message: "Game session not found" });
    //         }
    //
    //         const battle_cards = game_info.users_battle_info.find(c => c._id.toString() === player_id);
    //
    //         if (!battle_cards || !battle_cards.user_cards || !battle_cards.user_cards.battle_cards) {
    //             return socket.emit({ message: "Player battle cards not found" });
    //         }
    //
    //         const battle_cards_ids = battle_cards.user_cards.battle_cards;
    //
    //         const cardsArray = battle_cards_ids.map(card => card.card_id);
    //
    //         const battle_card = await CardsModel.find({ _id: { $in: cardsArray } });
    //
    //         const formattedCardsArray = battle_card.map(cards => {
    //             const cardIdStr = cards._id.toString();
    //
    //             const matchedCard = battle_cards_ids.find(c => c.card_id.toString() === cardIdStr);
    //
    //             const userBaseCardId = matchedCard ? matchedCard.user_base_card_id : null;
    //
    //             console.log('userBaseCardId for card', cardIdStr, 'is:', userBaseCardId);
    //
    //             return {
    //                 menu_id: userBaseCardId,
    //                 id: cards._id,
    //                 name: cards.card_name,
    //                 description: cards.card_description || "",
    //                 avatar: cards.card_avatar,
    //                 lvl: cards.card_lvl_info?.lvl_number || 1,
    //                 rarity: cards.card_lvl_info?.lvl_name || 'Default',
    //                 damage: cards.card_stats?.card_damage || 0,
    //                 protection: cards.card_stats?.card_protection || 0
    //             }
    //         });
    //
    //         socket.emit("select_battle_card_list", {
    //             card: formattedCardsArray
    //         });
    //     } catch (err) {
    //         console.log('err', err);
    //     }
    // });

    socket.on("remove_battle_card", async (data) => {
        const { game_key, remove_id } = data;
        try {
            const player_id = (socket as SocketData).playerId;

            const game_info = await GamesModel.findOne({ game_key: game_key });
            const player_info = await UsersModel.findById(player_id);

            if (!game_info || !player_info) {
                console.log("Данные не найдены.");
                return;
            }

            console.log('deleting card', remove_id, 'in game', game_info._id);

            const user_entry = game_info.users_battle_info.find(u => u._id?.toString() === player_id?.toString());
            // const user_card_entry = player_info.myCards.find(c => c.user_base_card_id?.toString() === remove_id?.toString());
            if (!user_entry) {
                console.log("Игрок не найден.");
                return;
            }

            const user_card_entry = user_entry.user_cards.battle_cards.find(c => c.user_base_card_id?.toString() === remove_id?.toString())

            const battle_card = await CardsModel.findById(user_card_entry.card_id);
            if (!battle_card) {
                console.log("Карта не существует в базе данных.");
                return;
            }

            console.log('user_card_entry', user_card_entry);

            const updatedGame = await GamesModel.findOneAndUpdate(
                {
                    _id: game_info._id,
                    "users_battle_info._id": player_id
                },
                {
                    $pull: {
                        'users_battle_info.$.user_cards.battle_cards': {
                            user_base_card_id: user_card_entry.user_base_card_id,
                        }
                    }
                },
                { new: true }
            );

            if (!updatedGame) {
                console.log("Игра не найдена или игрок не участвует в ней.");
                return;
            }
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("select_card", async (data) => {
        const { game_key, player_id, card_id } = data;
        try {
            const game_info = await GamesModel.findOne({ game_key: game_key });
            if (!game_info) {
                console.log("Игра не найдена.");
                return;
            }

            const game_find_player = game_info.users_battle_info.find(p => p._id.toString() === player_id);
            if (!game_find_player) {
                console.log("Игрок не найден в игре.");
                return;
            }

            const cardIndex = game_find_player.user_cards.battle_cards.findIndex(
                c => c.user_base_card_id.toString() === card_id
            );

            if (cardIndex === -1) {
                console.log("Карта не найдена.");
                return;
            }

            if (isCardSelected !== null) {
                socket.emit("error_handler", "Вы уже выбрали карту.");
                return;
            }

            const card_to_change = game_find_player.user_cards.battle_cards[cardIndex].card_id;

            game_find_player.user_cards.select_card = card_to_change;
            game_find_player.user_cards.battle_cards.splice(cardIndex, 1);
            isCardSelected = card_to_change.toString();

            await game_info.save();
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("disconnect", async () => {
        try {
            const player_id = (socket as SocketData).playerId;
            const game_id = (socket as SocketData).gameId;

            const user_info = await UsersModel.findById(player_id);
            const game_info = await GamesModel.findById(game_id);

            if (!game_info || !user_info) {
                console.log("Игра не найдена.");
                return;
            }

            let updatedGame = await GamesModel.findOneAndUpdate(
                { _id: game_id },
                { $pull: { 'game_online.users': player_id } },
                { new: true }
            );

            const playerRoom = `game:${player_id}`;
            socket.leave(playerRoom);

            user_info.gameInfo = "Default";
            await user_info.save();

            if (!updatedGame) {
                console.log(`Игра ${game_id} не найдена при отключении игрока.`);
                return;
            }

            console.log(`Игрок ${player_id} вышел из игры ${game_id}`);
        } catch (err) {
            console.log('err', err);
        }
    });

}