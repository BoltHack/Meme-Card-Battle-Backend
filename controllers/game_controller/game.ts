import { Socket, Server } from "socket.io";
import { io } from "../../app";
import mongoose from "mongoose";

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import GamesModel from "../../models/GamesModel";

interface SocketData extends Socket {
  playerId?: string;
  gameId?: string;
}

interface GameData {
  users_battle_info: any;
}

interface PlayerData {
  myCards: any;
}

function getRandomMoney(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const gameClients: Record<string, string> = {};
let timers: Record<number, number> = {};

export const GAME = (socket: Socket) => {
  console.log(`Пользователь ${socket.id} подключился к игре.`);

  socket.on("join_game", async (data: any) => {
    console.log("join game");
    const { game_key, player_id } = data;
    try {
      const [user_info, game_info] = await Promise.all([
        UsersModel.findById(player_id),
        GamesModel.findOne({ game_key: game_key }),
      ]);

      if (!user_info || !game_info) {
        console.log("Игра или пользователь не найдены.");
        return;
      }

      const playerCurrentRoom = `InGame:${player_id}`;
      const activeSockets = await io.in(playerCurrentRoom).fetchSockets();

      if (activeSockets.length > 0) {
        const oldSocket = activeSockets[0];

        if (oldSocket.id !== socket.id) {
          console.log(`Игрок ${player_id} пытается зайти со второй вкладки.`);
          socket.emit("game_error", "already_InGame");
          return;
        }
      }

      if (user_info.gameInfo === "Search" && activeSockets.length > 0) {
        console.log(
          `Игрок ${player_id} уже находится в поиске игры в другой вкладке.`,
        );
        socket.emit("game_error", "already_InGame");
        return;
      }

      const game_id = game_info._id;

      let updatedGame = await GamesModel.findOneAndUpdate(
        { _id: game_id },
        { $addToSet: { "game_online.users": player_id } },
        { new: true },
      );

      if (!updatedGame) {
        console.log("Игра не найдена.");
        socket.emit("error", { message: "Игра не найдена" });
        return;
      }

      (socket as SocketData).playerId = player_id;
      (socket as SocketData).gameId = updatedGame._id.toString();
      gameClients[player_id] = socket.id;

      const playerRoom = `InGame:${player_id}`;
      socket.join(playerRoom);

      const gameRoom = `game_room:${game_info._id}`;
      socket.join(gameRoom);

      user_info.gameInfo = "InGame";
      await user_info.save();

      // (socket as SocketData).playerId = player_id;
      // gameClients[player_id] = socket.id;

      console.log(
        `Игрок ${player_id} успешно добавлен в игру ${updatedGame._id}`,
      );
      await get_players_info_func(game_info.game_key);
    } catch (err) {
      console.log("err", err);
    }
  });

  async function get_cards_func(arr: any) {
    try {
      const ids = arr.map((c) => c.card_id.toString());

      const player_cards = await CardsModel.find({ _id: { $in: ids } });

      const cardsLegendary = player_cards.filter(
        (card) => card?.card_lvl_info?.lvl_name === "LEGENDARY",
      );
      const cardsEpic = player_cards.filter(
        (card) => card?.card_lvl_info?.lvl_name === "EPIC",
      );
      const cardsRare = player_cards.filter(
        (card) => card?.card_lvl_info?.lvl_name === "RARE",
      );
      const cardsDefault = player_cards.filter(
        (card) => card?.card_lvl_info?.lvl_name === "DEFAULT",
      );

      const sortedCards = [
        ...cardsLegendary,
        ...cardsEpic,
        ...cardsRare,
        ...cardsDefault,
      ];

      const formattedCardsArray = sortedCards.flatMap((card) => {
        const isRandom = arr.find(
          (c) => c.card_id.toString() === card._id.toString(),
        );
        const count = isRandom.quantity || 1;

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
          protection: card.card_stats?.card_protection || 0,
          power_slot: card.power_slot || 5,
        }));
      });

      socket.emit("get_player_cards", {
        cards_data: formattedCardsArray,
      });
    } catch (error) {
      console.log("error", error);
    }
  }

  async function get_players_info_func(game_key: string) {
    try {
      const game_info = await GamesModel.findOne({ game_key: game_key });

      if (!game_info) return;

      const players_info = game_info.users_battle_info.map((ubi) => {
        return {
          id: ubi?._id.toString(),
          name: ubi?.user_name,
          avatar: ubi?.user_avatar,
          lvl: ubi?.user_lvl,
          health: ubi?.user_health,
          ult: ubi?.user_ult,
        };
      });

      const gameRoom = `game_room:${game_info._id.toString()}`;

      io.to(gameRoom).emit("players_info", {
        data: players_info,
      });
    } catch (error) {
      console.log("error", error);
    }
  }

  async function set_winner_func(userId: string) {
    try {
      const user_info = await UsersModel.findById(userId);

      user_info.money += getRandomMoney(500, 1000);
      user_info.save();
    } catch (error) {
      console.log("error", error);
    }
  }

  function processMatchResults(
    player: string,
    opponent: string,
    isWin: boolean,
  ) {
    const baseRatingFactor = 20;

    const expectedWinChance =
      1 / (1 + Math.pow(10, (opponent.rating - player.rating) / 400));

    let ratingChange = 0;
    if (isWin) {
      ratingChange = Math.round(baseRatingFactor * (1 - expectedWinChance));
      if (ratingChange < 2) ratingChange = 2;
    } else {
      ratingChange = Math.round(baseRatingFactor * (0 - expectedWinChance));
      if (ratingChange > -2) ratingChange = -2;
    }

    let xpGained = 0;
    if (isWin) {
      const baseWinXp = 100;

      let xpBonus = 0;
      if (opponent.xp > player.xp) {
        const xpDifference = opponent.xp - player.xp;
        xpBonus = Math.min(Math.round((xpDifference / 10000) * 5), 200);
      }

      xpGained = baseWinXp + Math.round(baseWinXp * (xpBonus / 100));
    } else {
      xpGained = 30;
    }

    return {
      ratingChange: ratingChange,
      xpGained: xpGained,
    };
  }

  async function get_player_prize(
    userId: string,
    opponentId: string,
    gameId: string,
  ) {
    try {
      const [user_info, opponent_info, game_info] = await Promise.all([
        await UsersModel.findById(userId),
        await UsersModel.findById(opponentId),
        await GamesModel.findById(gameId),
      ]);

      if (!user_info || !opponent_info || !game_info) return null;

      game_info.game_started = false;
      await game_info.save();

      let currentLVL = Number(user_info.lvl);
      let currentXP = user_info.lvlXP;
      let currentRating = user_info.rating;

      let leveledUp = false;
      let xpNeeded = Math.round(Math.pow(currentLVL, 1.5) * 2500);

      let player = { xp: currentXP, rating: currentRating };
      let opponent = { xp: opponent_info.lvlXP, rating: opponent_info.rating };

      let winner_result = processMatchResults(player, opponent, true);
      let loser_result = processMatchResults(opponent, player, false);

      console.log("winner result", winner_result);
      console.log("loser result", loser_result);

      while (currentXP + winner_result.xpGained >= xpNeeded) {
        currentLVL += 1;
        xpNeeded = Math.round(Math.pow(currentLVL, 1.5) * 2500);
        leveledUp = true;
      }

      const updatedUser = await UsersModel.findOneAndUpdate(
        { _id: user_info.id },
        {
          $set: {
            lvl: currentLVL < 100 ? currentLVL : 100,
            lvlXP: currentXP + winner_result.xpGained,
            rating: user_info.rating + winner_result.ratingChange,
          },
          $inc: {
            wins: 1,
            gamesCount: 1,
          },
        },
        { new: true },
      );

      await UsersModel.findOneAndUpdate(
        { _id: opponent_info.id },
        {
          $set: {
            rating: Math.max(
              0,
              opponent_info.rating + loser_result.ratingChange,
            ),
          },
          $inc: {
            lvlXP: loser_result.xpGained,
            gamesCount: 1,
          },
        },
        { new: true },
      );

      if (leveledUp) {
        console.log(`New lvl: ${currentLVL}!`);
      }

      return updatedUser ? winner_result.xpGained : 0;
    } catch (error) {
      console.log("error", error);
    }
  }

  // async function get_player_prize(userID: string, gameID: string) {
  //   try {
  //     const [user_info, game_info] = await Promise.all([
  //       await UsersModel.findById(userID),
  //       await GamesModel.findById(gameID),
  //     ]);

  //     if (!user_info || !game_info) return null;

  //     game_info.game_started = false;
  //     await game_info.save();

  //     const battle_info = game_info.users_battle_info.find(
  //       (ubi) => ubi._id.toString() === userID.toString(),
  //     );

  //     const userHealth = battle_info.user_health;

  //     let currentLVL = Number(user_info.lvl);
  //     let currentXP = user_info.lvlXP + currentLVL * userHealth;

  //     let xpNeeded = Math.round(Math.pow(currentLVL, 1.5) * 2500);
  //     let leveledUp = false;

  //     while (currentXP >= xpNeeded) {
  //       currentLVL += 1;
  //       xpNeeded = Math.round(Math.pow(currentLVL, 1.5) * 2500);
  //       leveledUp = true;
  //     }

  //     const updatedUser = await UsersModel.findOneAndUpdate(
  //       { _id: userID },
  //       {
  //         $set: {
  //           lvl: currentLVL < 100 ? currentLVL : 100,
  //           lvlXP: currentXP,
  //         },
  //         $inc: {
  //           wins: 1,
  //         },
  //       },
  //       { new: true },
  //     );

  //     if (leveledUp) {
  //       console.log(`New lvl: ${currentLVL}!`);
  //     }

  //     return updatedUser ? currentXP - user_info.lvlXP : null;
  //   } catch (error) {
  //     console.log("error", error);
  //   }
  // }

  async function game_selected_cards_result_func(gameId: string) {
    try {
      const game_info = (await GamesModel.findById(gameId)) as GameData;

      if (!game_info) return;

      const cardIds = game_info.users_battle_info
        .map((ubi) => ubi.user_cards.select_card)
        .filter(Boolean);

      const cards = await CardsModel.find({ _id: { $in: cardIds } });
      const cardsMap = new Map(cards.map((c) => [c._id.toString(), c]));

      const players_damage_info = game_info.users_battle_info.map((ubi) => {
        const card_info = cardsMap.get(ubi.user_cards.select_card?.toString());
        return {
          userId: ubi._id.toString(),
          damage: card_info?.card_stats?.card_damage || 0,
          protection: card_info?.card_stats?.card_protection || 0,
        };
      });

      if (!players_damage_info[0] || !players_damage_info[1]) {
        console.log("Ошибка: Недостаточно данных о игроках для расчета урона");
        return;
      }

      const player1 = players_damage_info[0];
      const player2 = players_damage_info[1];

      const p1_damage = Math.max(player1.damage - player2.protection, 0);
      const p2_damage = Math.max(player2.damage - player1.protection, 0);

      console.log(`Игрок 1 нанес чистый урон: ${p1_damage}`);
      console.log(`Игрок 2 нанес чистый урон: ${p2_damage}`);

      let result: {
        status: string | null;
        winnerId: string | null;
        damage: number | 0;
        text: string | null;
      } = {
        status: null,
        winnerId: null,
        damage: 0,
        text: null,
      };

      const game_ubi = game_info.users_battle_info;
      const users_cards = game_ubi.map(
        (ubi: any) => ubi.user_cards.battle_cards,
      );
      const all_cards = users_cards.every((cards: any) => cards.length === 0);

      if (p1_damage > p2_damage) {
        let finalDamage = p1_damage;
        if (game_ubi[0].user_ult >= 100) {
          game_ubi[0].user_ult = 0;
          finalDamage = p1_damage * 2;
        } else {
          game_ubi[0].user_ult += p1_damage / 2;
        }
        game_ubi[1].user_health -= finalDamage;

        result = {
          status: "damage",
          winnerId: player1.userId,
          damage: finalDamage,
          text: `Игрок 1 нанёс урон в ${finalDamage} единиц.`,
        };

        console.log("all_cards 1", all_cards);
      } else if (p2_damage > p1_damage) {
        let finalDamage = p2_damage;
        if (game_ubi[1].user_ult >= 100) {
          game_ubi[1].user_ult = 0;
          finalDamage = p2_damage * 2;
        } else {
          game_ubi[1].user_ult += p2_damage / 2;
        }
        game_ubi[0].user_health -= finalDamage;

        console.log("all_cards 2", all_cards);

        result = {
          status: "damage",
          winnerId: player2.userId,
          damage: finalDamage,
          text: `Игрок 2 нанёс урон в ${finalDamage} единиц.`,
        };
      } else {
        result = {
          status: "draw",
          winnerId: null,
          damage: 0,
          text: "Карты закончились. Абсолютная ничья по здоровью! (else)",
        };
      }

      if (
        game_ubi[1].user_health < 1 ||
        (game_ubi[0].user_health > game_ubi[1].user_health && all_cards)
      ) {
        await set_winner_func(player1.userId);
        result = {
          status: "win",
          winnerId: player1.userId,
          damage: 0,
          text: "Победил Игрок 1.",
        };
      } else if (
        game_ubi[0].user_health < 1 ||
        (game_ubi[1].user_health > game_ubi[0].user_health && all_cards)
      ) {
        await set_winner_func(player1.userId);
        result = {
          status: "win",
          winnerId: player2.userId,
          damage: 0,
          text: "Победил Игрок 2.",
        };
      } else {
        console.log("Раунд завершился ничьей.");
      }

      // if (p1_damage > p2_damage) {
      //   let finalDamage = p1_damage;
      //   if (game_ubi[0].user_ult >= 100) {
      //     game_ubi[0].user_ult = 0;
      //     finalDamage = p1_damage * 2;
      //   } else {
      //     game_ubi[0].user_ult += p1_damage / 2;
      //   }
      //   game_ubi[1].user_health -= finalDamage;

      //   console.log("all_cards 1", all_cards);

      //   if (
      //     game_ubi[1].user_health < 1 ||
      //     (game_ubi[0].user_health > game_ubi[1].user_health && all_cards)
      //   ) {
      //     await set_winner_func(player1.userId);
      //     result = {
      //       status: "win",
      //       winnerId: player1.userId,
      //       damage: finalDamage,
      //       text: "Победил Игрок 1. (if)",
      //     };
      //   } else {
      //     console.log("user 0 health", game_ubi[0].user_health);
      //     console.log("user 1 health", game_ubi[1].user_health);
      //     result = {
      //       status: "damage",
      //       winnerId: player1.userId,
      //       damage: finalDamage,
      //       text: `Игрок 1 нанёс урон в ${finalDamage} единиц. (if)`,
      //     };
      //   }
      // } else if (p2_damage > p1_damage) {
      //   let finalDamage = p2_damage;
      //   if (game_ubi[1].user_ult >= 100) {
      //     game_ubi[1].user_ult = 0;
      //     finalDamage = p2_damage * 2;
      //   } else {
      //     game_ubi[1].user_ult += p2_damage / 2;
      //   }
      //   game_ubi[0].user_health -= finalDamage;

      //   console.log("all_cards 2", all_cards);

      //   if (
      //     game_ubi[0].user_health < 1 ||
      //     (game_ubi[1].user_health > game_ubi[0].user_health && all_cards)
      //   ) {
      //     await set_winner_func(player2.userId);
      //     result = {
      //       status: "win",
      //       winnerId: player2.userId,
      //       damage: finalDamage,
      //       text: "Победил Игрок 2. (else if)",
      //     };
      //   } else {
      //     console.log("user 0 health", game_ubi[0].user_health);
      //     console.log("user 1 health", game_ubi[1].user_health);
      //     result = {
      //       status: "damage",
      //       winnerId: player2.userId,
      //       damage: finalDamage,
      //       text: `Игрок 2 нанёс урон в ${finalDamage} единиц. (else if)`,
      //     };
      //   }
      // } else {
      //   if (all_cards) {
      //     if (game_ubi[0].user_health > game_ubi[1].user_health) {
      //       await set_winner_func(player1.userId);
      //       result = {
      //         status: "win",
      //         winnerId: player1.userId,
      //         damage: 0,
      //         text: "Карты закончились. По здоровью победил Игрок 1. (else)",
      //       };
      //     } else if (game_ubi[1].user_health > game_ubi[0].user_health) {
      //       await set_winner_func(player2.userId);
      //       result = {
      //         status: "win",
      //         winnerId: player2.userId,
      //         damage: 0,
      //         text: "Карты закончились. По здоровью победил Игрок 2. (else)",
      //       };
      //     } else {
      //       result = {
      //         status: "draw",
      //         winnerId: null,
      //         damage: 0,
      //         text: "Карты закончились. Абсолютная ничья по здоровью! (else)",
      //       };
      //     }
      //   }
      // }

      console.log("battle result", result);

      game_info.markModified("users_battle_info");
      await game_info.save();

      const gameRoom = `game_room:${gameId}`;

      io.to(gameRoom).emit("game_cards_selected_result", {
        type: "result",
        gameData: {
          winnerId: result.winnerId ? result.winnerId.toString() : null,
          result: result,
          exp:
            result.status === "win"
              ? await get_player_prize(
                  result?.winnerId === player1.userId
                    ? player1.userId
                    : player2.userId,
                  result?.winnerId === player1.userId
                    ? player2.userId
                    : player1.userId,
                  gameId,
                )
              : 0,
          // exp:
          //   result.status === "win"
          //     ? await get_player_prize(result?.winnerId, gameId)
          //     : 0,
        },
      });
    } catch (error) {
      console.log("error", error);
    }
  }

  async function clear_selected_cards_func(gameId: string) {
    try {
      const game_info = await GamesModel.findById(gameId);

      if (!game_info) return;

      const updateResult = await GamesModel.updateOne(
        { _id: gameId },
        { $set: { "users_battle_info.$[].user_cards.select_card": "" } },
      );

      if (updateResult.matchedCount === 0) return;

      // game_info.users_battle_info.forEach(ubi => {
      //     if (ubi.user_cards) {
      //         ubi.user_cards.select_card = "";
      //     }
      // });
      //
      // game_info.markModified('users_battle_info');
      //
      // await game_info.save();

      const gameRoom = `game_room:${gameId}`;

      io.to(gameRoom).emit("game_cards_selected_result", {
        type: "clear",
      });
    } catch (error) {
      console.log("error", error);
    }
  }

  async function start_cooldown_func(
    gameId: string,
    game_key: string,
    startTime: number,
  ) {
    const gameTimerId: string = gameId.toString();
    try {
      game_selected_cards_result_func(gameId);
      if (timers[gameTimerId]) {
        clearTimeout(timers[gameTimerId]);
        delete timers[gameTimerId];
      }

      const gameRoom = `game_room:${gameTimerId}`;
      let timeLeft = startTime;

      const tick = async () => {
        try {
          if (timeLeft <= -1) {
            clearTimeout(timers[gameTimerId]);
            delete timers[gameTimerId];

            console.log(`Game ${gameTimerId}: finish`);
            await clear_selected_cards_func(gameId);
            await get_players_info_func(game_key);
            return;
          }
          console.log(`Game ${gameTimerId}: timer:`, timeLeft);
          io.to(gameRoom).emit("game_cards_selected_result", {
            type: "timer",
            gameData: {
              timer: timeLeft,
            },
          });
          timeLeft--;

          timers[gameTimerId] = setTimeout(tick, 1000);
        } catch (err) {
          console.log("timer error", err);
          clearTimeout(timers[gameTimerId]);
          delete timers[gameTimerId];
        }
      };
      await tick();
    } catch (error) {
      console.log("error", error);
    }
  }

  async function check_game_online_to_end(game_key: string) {
    try {
      const game_info = await GamesModel.findOne({ game_key: game_key });

      if (!game_info) {
        throw new Error("Игра не найдена");
      }

      const gameRoom = `game_room:${game_info._id.toString()}`;

      const playerIds = game_info.users_battle_info.map((ubi) =>
        ubi._id.toString(),
      );

      for (const ubi of game_info.users_battle_info) {
        const currentPlayerId = ubi._id.toString();

        if (
          (ubi.user_isReady && !game_info.game_started) ||
          (!ubi.user_isReady && !game_info.game_started)
        ) {
          console.log("Игрок вышел до начала игры.");
          if (game_info.game_online.users.length === 0) {
            await GamesModel.findByIdAndDelete(game_info.id);
          }
          return;
        }
        console.log("Игрок вышел во время игры");

        const winnerId = playerIds.find((pId) => pId !== currentPlayerId);

        console.log("winnerId", winnerId);

        io.to(gameRoom).emit("game_cards_selected_result", {
          type: "result",
          gameData: {
            winnerId: winnerId,
            result: {
              status: "autowin",
              damage: 100,
              winnerId: winnerId,
            },
          },
        });

        if (game_info.game_online.users.length === 0) {
          await GamesModel.findByIdAndDelete(game_info.id);
        }

        return;
      }
    } catch (error) {
      console.log("error", error);
    }
  }

  socket.on("check_user_ready_state_server", async (data) => {
    const { player_id, game_key } = data;
    try {
      const [game_info, user_info] = await Promise.all([
        GamesModel.findOne({ game_key: game_key }),
        UsersModel.findById(player_id),
      ]);

      if (!game_info) {
        socket.emit("error_handler", "Игра не найдена.");
        return;
      }

      if (!user_info) {
        socket.emit("error_handler", "Пользователь не найден.");
        return;
      }

      if (game_info.game_online.users.length < 2) {
        socket.emit("error_handler", "Ваш противник вышел из игры.");
        return;
      }

      const playerIndex = game_info.users_battle_info.findIndex(
        (ubi) => ubi._id.toString() === player_id,
      );

      if (playerIndex === -1) {
        socket.emit("error_handler", "index пользователя не найден.");
        return;
      }

      const user_cards_cound =
        game_info.users_battle_info[playerIndex].user_cards.battle_cards;

      if (user_cards_cound.length < 8) {
        socket.emit(
          "error_handler",
          "У вас неполная колода, чтобы начать игру",
        );
        return;
      }

      const updatedGame = await GamesModel.findOneAndUpdate(
        {
          _id: game_info.id,
          "users_battle_info._id": player_id,
        },
        {
          $set: {
            "users_battle_info.$.user_isReady": true,
          },
        },
        { new: true },
      );

      const users_ready = updatedGame.users_battle_info.map(
        (ubi) => ubi.user_isReady,
      );

      const all_ready = users_ready.every((ready) => ready === true);

      const gameRoom = `game_room:${game_info._id.toString()}`;

      if (all_ready) {
        console.log("Игроки готовы к бою.", users_ready);
        game_info.game_started = true;
        await game_info.save();
        io.to(gameRoom).emit("check_user_ready_state_client", "game_start");
      } else {
        socket.emit("check_user_ready_state_client", "user_ready");
      }
    } catch (error) {
      console.log("error", error);
    }
  });

  socket.on("get_players_info", async (data) => {
    const { game_key } = data;

    try {
      console.log("game_key, player_id", game_key);

      await get_players_info_func(game_key);
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("get_user_cards", async (data) => {
    const { player_id } = data;
    try {
      // const player_id = (socket as SocketData).playerId;

      const player_info = (await UsersModel.findById(player_id)) as PlayerData;

      if (!player_info) return;

      const player_cards = player_info.myCards;

      await get_cards_func(player_cards);
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("check_battle_card", async (data) => {
    const { game_key, player_id, enemy_id, card_id, menu_id } = data;
    try {
      const game_info = (await GamesModel.findOne({
        game_key: game_key,
      })) as GameData;
      const player_info = (await UsersModel.findById(player_id)) as PlayerData;

      const playerIndex = game_info.users_battle_info.findIndex(
        (p) => p._id.toString() === player_id,
      );
      const player_cards_length =
        game_info.users_battle_info[playerIndex].user_cards.battle_cards.length;

      console.log("player_cards_length", player_cards_length);
      if (player_cards_length >= 8) {
        console.log("Лимит карт достигнут.");
        socket.emit(
          "error_handler",
          "Вы не можете набрать в колоду больше 8 карт.",
        );
        return;
      }

      const user_card_entry = player_info.myCards.find(
        (c) => c.card_id?.toString() === card_id.toString(),
      );
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
          "users_battle_info._id": player_id,
        },
        {
          $addToSet: {
            "users_battle_info.$.user_cards.battle_cards": {
              card_id: battle_card,
              user_base_card_id: menu_id,
            },
          },
          $inc: {
            "users_battle_info.$.user_cards.cards_power":
              battle_card.power_slot,
          },
        },
        { new: true },
      );

      if (!updatedGame) {
        console.log("Игра не найдена.");
        return;
      }

      const matched_socket_id = gameClients[enemy_id];
      io.to(matched_socket_id).emit("enemy_hand_list", "battle_card_selected");

      socket.emit("select_battle_card", {
        card: battle_card,
        menu_id: menu_id,
      });
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("clear_game_cards", async (data) => {
    const { game_key, player_id } = data;
    try {
      const game_info = (await GamesModel.findOne({
        game_key: game_key,
      })) as GameData;

      if (!game_info || !game_info.users_battle_info) {
        // return socket.emit({ message: "Game session not found" });
        console.log("Игра не найдена.");
        return;
      }

      const playerIndex = game_info.users_battle_info.findIndex(
        (p) => p._id.toString() === player_id,
      );
      if (playerIndex === -1) {
        console.log("Игрок не найден в игре.");
        return;
      }

      if (
        game_info.users_battle_info[playerIndex].user_cards.battle_cards
          .length < 1 &&
        game_info.users_battle_info[playerIndex].user_cards.select_card === ""
      )
        return;

      game_info.users_battle_info[playerIndex].user_cards.battle_cards = [];
      game_info.users_battle_info[playerIndex].user_cards.select_card = "";
      game_info.save();
    } catch (err) {
      console.log("err", err);
    }
  });

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
    const { game_key, remove_id, enemy_id } = data;
    try {
      const player_id = (socket as SocketData).playerId;

      const game_info = await GamesModel.findOne({ game_key: game_key });
      const player_info = await UsersModel.findById(player_id);

      if (!game_info || !player_info) {
        console.log("Данные не найдены.");
        return;
      }

      console.log("deleting card", remove_id, "in game", game_info._id);

      const user_entry = game_info.users_battle_info.find(
        (u) => u._id?.toString() === player_id?.toString(),
      );
      // const user_card_entry = player_info.myCards.find(c => c.user_base_card_id?.toString() === remove_id?.toString());
      if (!user_entry) {
        console.log("Игрок не найден.");
        return;
      }

      const user_card_entry = user_entry.user_cards.battle_cards.find(
        (c) => c.user_base_card_id?.toString() === remove_id?.toString(),
      );

      const battle_card = await CardsModel.findById(user_card_entry.card_id);
      if (!battle_card) {
        console.log("Карта не существует в базе данных.");
        return;
      }

      console.log("user_card_entry", user_card_entry);

      const updatedGame = await GamesModel.findOneAndUpdate(
        {
          _id: game_info._id,
          "users_battle_info._id": player_id,
        },
        {
          $pull: {
            "users_battle_info.$.user_cards.battle_cards": {
              user_base_card_id: user_card_entry.user_base_card_id,
            },
          },
          $inc: {
            "users_battle_info.$.user_cards.cards_power":
              -battle_card.power_slot,
          },
        },
        { new: true },
      );

      if (!updatedGame) {
        console.log("Игра не найдена или игрок не участвует в ней.");
        return;
      }

      const matched_socket_id = gameClients[enemy_id];
      io.to(matched_socket_id).emit("enemy_hand_list", "battle_card_removed");
    } catch (err) {
      console.log("err", err);
    }
  });

  // socket.on("select_card", async (data) => {
  //   const { game_key, player_id, enemy_id, card_id } = data;
  //   try {
  //     const [game_info, enemy_info] = await Promise.all([
  //       await GamesModel.findOne({ game_key: game_key }),
  //       await UsersModel.findById(enemy_id),
  //     ]);

  //     if (!game_info) {
  //       console.log("Игра не найдена.");
  //       return;
  //     }

  //     if (!enemy_info && game_info.game_type === "player_player") {
  //       console.log("Вражеский игрок не найден.");
  //       return;
  //     }

  //     const game_find_player = game_info.users_battle_info.find(
  //       (p) => p._id.toString() === player_id,
  //     );
  //     if (!game_find_player) {
  //       console.log("Игрок не найден в игре.");
  //       return;
  //     }

  //     const cardIndex = game_find_player.user_cards.battle_cards.findIndex(
  //       (c) => c.user_base_card_id.toString() === card_id,
  //     );

  //     if (cardIndex === -1) {
  //       console.log("Карта не найдена.");
  //       return;
  //     }

  //     if (
  //       game_find_player.user_cards.select_card &&
  //       game_find_player.user_cards.select_card !== ""
  //     ) {
  //       socket.emit("error_handler", "Вы уже выбрали карту.");
  //       return;
  //     }

  //     const card_to_change =
  //       game_find_player.user_cards.battle_cards[cardIndex].card_id;

  //     game_find_player.user_cards.select_card = card_to_change;
  //     game_find_player.user_cards.battle_cards.splice(cardIndex, 1);

  //     await game_info.save();

  //     const matched_socket_id = gameClients[enemy_info.id];
  //     io.to(matched_socket_id).emit("enemy_hand_list", "card_selected");

  //     const selected_cards = game_info.users_battle_info
  //       .map((mgi) => mgi.user_cards.select_card)
  //       .toString();

  //     if (selected_cards.length === 49) {
  //       // const parts = selected_cards.split(",");
  //       // const cards_info = await CardsModel.find({
  //       //   _id: { $in: parts },
  //       // });

  //       const playersCards = await Promise.all(
  //         game_info.users_battle_info.map(async (cards) => {
  //           const select_card = cards.user_cards.select_card;
  //           const playerId = cards._id.toString();

  //           const cards_list = await CardsModel.find({
  //             _id: { $in: select_card },
  //           });

  //           const formattedCards = cards_list.map((card) => ({
  //             playerId: playerId,
  //             id: card.id || card._id.toString(),
  //             name: card.card_name,
  //             description: card.card_description,
  //             avatar: card.card_avatar,
  //             lvl: card.card_lvl_info?.lvl_number,
  //             rarity: card.card_lvl_info?.lvl_name,
  //             damage: card.card_stats?.card_damage,
  //             protection: card.card_stats?.card_protection,
  //             power_slot: card.power_slot,
  //           }));

  //           return formattedCards;
  //         }),
  //       );

  //       const allCardsFlat = playersCards.flat();

  //       const gameId = game_info._id.toString();
  //       const gameRoom = `game_room:${gameId}`;

  //       io.to(gameRoom).emit("game_cards_selected", {
  //         cards: allCardsFlat,
  //       });

  //       await start_cooldown_func(gameId, game_info.game_key, 5);
  //     }
  //   } catch (err) {
  //     console.log("err", err);
  //   }
  // });

  socket.on("select_card", async (data) => {
    const { game_key, player_id, enemy_id, card_id } = data;

    try {
      const [game_info, enemy_info] = await Promise.all([
        GamesModel.findOne({ game_key }),
        UsersModel.findById(enemy_id),
      ]);

      if (!game_info) {
        console.log("Игра не найдена.");
        return;
      }

      const isPvP = game_info.game_type === "player_player";

      if (!enemy_info && isPvP) {
        console.log("Вражеский игрок не найден.");
        return;
      }

      const game_find_player = game_info.users_battle_info.find(
        (p) => p._id.toString() === player_id,
      );
      if (!game_find_player) {
        console.log("Игрок не найден в игре.");
        return;
      }

      if (game_find_player.user_cards.select_card) {
        socket.emit("error_handler", "Вы уже выбрали карту.");
        return;
      }

      const cardIndex = game_find_player.user_cards.battle_cards.findIndex(
        (c) => c.user_base_card_id.toString() === card_id,
      );

      if (cardIndex === -1) {
        console.log("Карта не найдена в руке.");
        return;
      }

      const card_to_change =
        game_find_player.user_cards.battle_cards[cardIndex].card_id;
      game_find_player.user_cards.select_card = card_to_change;

      game_find_player.user_cards.battle_cards.splice(cardIndex, 1);

      await game_info.save();

      if (isPvP && enemy_info && gameClients[enemy_info.id]) {
        const matched_socket_id = gameClients[enemy_info.id];
        io.to(matched_socket_id).emit("enemy_hand_list", "card_selected");
      }

      const allPlayersReady = game_info.users_battle_info.every(
        (player) =>
          player.user_cards.select_card && player.user_cards.select_card !== "",
      );

      if (allPlayersReady) {
        const allSelectedCardIds = game_info.users_battle_info.map(
          (player) => player.user_cards.select_card,
        );

        const dbCards = await CardsModel.find({
          _id: { $in: allSelectedCardIds },
        });

        const cardsMap = new Map(dbCards.map((c) => [c._id.toString(), c]));

        const allCardsFlat = game_info.users_battle_info
          .map((player) => {
            const select_card_id = player.user_cards.select_card.toString();
            const card = cardsMap.get(select_card_id);

            if (!card) return null;

            return {
              playerId: player._id.toString(),
              id: card.id || card._id.toString(),
              name: card.card_name,
              description: card.card_description,
              avatar: card.card_avatar,
              lvl: card.card_lvl_info?.lvl_number,
              rarity: card.card_lvl_info?.lvl_name,
              damage: card.card_stats?.card_damage,
              protection: card.card_stats?.card_protection,
              power_slot: card.power_slot,
            };
          })
          .filter(Boolean);

        const gameId = game_info._id.toString();
        const gameRoom = `game_room:${gameId}`;

        io.to(gameRoom).emit("game_cards_selected", {
          cards: allCardsFlat,
        });

        await start_cooldown_func(gameId, game_info.game_key, 5);
      }
    } catch (err) {
      console.error("Ошибка в обработчике select_card:", err);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const player_id = (socket as SocketData).playerId;
      const game_id = (socket as SocketData).gameId;

      const [user_info, updatedGame] = await Promise.all([
        UsersModel.findById(player_id),
        GamesModel.findOneAndUpdate(
          { _id: game_id },
          { $pull: { "game_online.users": player_id } },
          { new: true },
        ),
      ]);

      if (!user_info) {
        console.log(`Пользователь ${player_id} не найден в базе.`);
        return;
      }

      if (!updatedGame) {
        console.log(`Игра ${game_id} не найдена при отключении игрока.`);
        return;
      }

      const playerRoom = `InGame:${player_id}`;
      await socket.leave(playerRoom);

      user_info.gameInfo = "Default";
      await user_info.save();

      await check_game_online_to_end(updatedGame.game_key);

      console.log(`Игрок ${player_id} вышел из игры ${game_id}`);
    } catch (err) {
      console.log("err", err);
    }
  });
};
