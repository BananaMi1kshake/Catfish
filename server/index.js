require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const axios = require('axios');

console.log("Pexels API Key Loaded:", process.env.PEXELS_API_KEY ? "Yes, key found." : "No - THIS IS LIKELY THE PROBLEM.");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  allowEIO3: true
});


// --- Game State & Data ---
let players = [];
let catfishProfiles = {};
let targetAssignments = {};
let sabotageCounts = {};
let playerDecisions = {};
let sabotageActions = {};
let allMessages = [];
let playerVotes = {};

let gameLoop = null;
let gameState = { phase: 'Lobby', timeLeft: 0, duration: 0, round: 0, totalRounds: 3 };
const PHASE_DURATIONS = {
  Assignment: 15,
  ProfileCreation: 90,
  Sabotage: 60,
  Chat: 120,
  Decision: 30,
};

// --- Game Functions ---
const startRound = () => {
  if (gameLoop) clearInterval(gameLoop);
  
  gameState.round++;
  catfishProfiles = {};
  targetAssignments = {};
  sabotageCounts = {};
  playerDecisions = {};
  sabotageActions = {};
  allMessages = [];
  playerVotes = {};
  players.forEach(p => sabotageCounts[p.id] = 0);

  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  players.forEach((player, index) => {
    let target = shuffledPlayers[index];
    if (player.id === target.id) target = shuffledPlayers[(index + 1) % shuffledPlayers.length];
    targetAssignments[player.id] = target.id;
    io.to(player.id).emit('gameStarted', { target });
  });
  
  gameState.phase = 'Assignment';
  gameState.duration = PHASE_DURATIONS.Assignment;
  gameState.timeLeft = gameState.duration;
  gameLoop = setInterval(gameTick, 1000);
  gameTick(); // Send initial tick immediately
};

const advancePhase = () => {
  switch (gameState.phase) {
    case 'Assignment':
      gameState.phase = 'ProfileCreation';
      break;
    case 'ProfileCreation':
      gameState.phase = 'Sabotage';
      io.emit('startSabotage', catfishProfiles);
      break;
    case 'Sabotage':
      gameState.phase = 'Chat';
      players.forEach(p => {
        const creatorId = Object.keys(targetAssignments).find(key => targetAssignments[key] === p.id);
        const profileForPlayer = catfishProfiles[creatorId];
        io.to(p.id).emit('startChat', { catfishProfile: profileForPlayer });
      });
      break;
    case 'Chat':
      gameState.phase = 'Decision';
      playerDecisions = {};
      io.emit('startDecision');
      break;
    case 'Decision':
      gameState.phase = 'Reveal';
      if (gameLoop) clearInterval(gameLoop);
      
      const scores = {};
      players.forEach(p => scores[p.id] = 0);
      players.forEach(p => {
        const targetId = targetAssignments[p.id];
        if (playerDecisions[targetId] === 'agree') scores[p.id] += 1000;
        
        const playerSabotages = Object.values(sabotageActions).flat().filter(action => action.sabotagerId === p.id);
        playerSabotages.forEach(sabotageInfo => {
            const sabotagedProfileCreatorId = Object.keys(sabotageActions).find(key => sabotageActions[key].includes(sabotageInfo));
            const sabotagedTargetId = targetAssignments[sabotagedProfileCreatorId];
            if (playerDecisions[sabotagedTargetId] === 'reject') {
                scores[p.id] += 250;
            }
        });
      });
      players.forEach(p => p.score += scores[p.id]);
      io.emit('startReveal', { players, targetAssignments, catfishProfiles, playerDecisions, allMessages, roundScores: scores, sabotageActions });
      return;
  }
  gameState.duration = PHASE_DURATIONS[gameState.phase];
  gameState.timeLeft = gameState.duration;
};

const gameTick = () => {
  io.emit('tick', gameState);
  if (gameState.timeLeft > 0) {
    gameState.timeLeft--;
  } else {
    advancePhase();
  }
};

// --- Socket Connection ---
io.on('connection', (socket) => {
  socket.on('joinLobby', (playerName) => {
    if (!players.find(p => p.id === socket.id)) {
      const newPlayer = { id: socket.id, name: playerName, score: 0 };
      players.push(newPlayer);
    }
    io.emit('updatePlayerList', players);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit('updatePlayerList', players);
    if (players.length < 2 && gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
      gameState.phase = 'Lobby';
      io.emit('gameEnded');
    }
  });

  socket.on('startGame', () => {
    if (gameLoop) return;
    gameState.round = 0;
    players.forEach(p => p.score = 0);
    startRound();
  });
  
  socket.on('submitProfile', (profileData) => {
    if (!catfishProfiles[socket.id]) {
      catfishProfiles[socket.id] = { ...profileData, creatorId: socket.id };
      if (gameState.phase === 'ProfileCreation' && Object.keys(catfishProfiles).length === players.length) {
        advancePhase();
        gameTick();
      }
    }
  });

  socket.on('sabotageAction', ({ targetCreatorId, field, index, oldValue, newValue }) => {
    if ((sabotageCounts[socket.id] || 0) < 3) {
      const sabotagerName = players.find(p => p.id === socket.id)?.name;
      const sabotageInfo = { sabotagerId: socket.id, sabotagerName, field, oldValue, newValue };
      if (!sabotageActions[targetCreatorId]) sabotageActions[targetCreatorId] = [];
      sabotageActions[targetCreatorId].push(sabotageInfo);
      const profile = catfishProfiles[targetCreatorId];
      if (profile) {
        if (field === 'imageUrl') profile.imageUrl = newValue;
        else if (field === 'fakeName') profile.fakeName = newValue;
        else if (field === 'bio') profile.bio = newValue;
        else if (field === 'likes' || field === 'dislikes') profile[field][index] = newValue;
      }
      sabotageCounts[socket.id]++;
      io.emit('profilesUpdated', catfishProfiles);
      const allPlayersDoneSabotaging = players.every(p => (sabotageCounts[p.id] || 0) === 3);
      if (gameState.phase === 'Sabotage' && allPlayersDoneSabotaging) {
        advancePhase();
        gameTick();
      }
    }
  });

  socket.on('submitDecision', ({ decision }) => {
    if (!playerDecisions[socket.id]) {
      playerDecisions[socket.id] = decision;
      if (gameState.phase === 'Decision' && Object.keys(playerDecisions).length === players.length) {
        advancePhase();
      }
    }
  });

  socket.on('submitVote', ({ votedForId }) => {
    if (!playerVotes[socket.id]) {
      playerVotes[socket.id] = votedForId;
      if (Object.keys(playerVotes).length === players.length) {
        const voteCounts = {};
        Object.values(playerVotes).forEach(votedId => {
          voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
        });
        players.forEach(p => {
          if (voteCounts[p.id]) {
            p.score += voteCounts[p.id] * 200;
          }
        });

        if (gameState.round < gameState.totalRounds) {
          io.emit('startIntermission', { players, round: gameState.round + 1 });
        } else {
          io.emit('gameOver', { players });
        }
      }
    }
  });

  socket.on('requestNextRound', () => {
    // Ensure only one person (e.g., the host) can trigger this
    if (socket.id === players[0].id) {
        startRound();
    }
  });

  socket.on('sendMessage', ({ recipientId, text }) => {
    const message = { senderId: socket.id, recipientId, text };
    allMessages.push(message);
    io.to(recipientId).emit('receiveMessage', { senderId: socket.id, text });
  });

  socket.on('searchImages', async (searchTerm) => {
    if (!process.env.PEXELS_API_KEY) {
      console.error("Pexels API Key is missing.");
      return socket.emit('imageResults', []);
    }
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: process.env.PEXELS_API_KEY },
        params: { query: searchTerm, per_page: 15 }
      });
      const imageResults = response.data.photos.map(photo => ({ id: photo.id, url: photo.src.medium }));
      socket.emit('imageResults', imageResults);
    } catch (error) {
      console.error("--- PEXELS API FAILED ---");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else {
        console.error('Error Message:', error.message);
      }
      socket.emit('imageResults', []);
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`🎉 Server running on port ${PORT}`));