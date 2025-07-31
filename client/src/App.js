import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { FaPaperPlane, FaSearch, FaUpload, FaTrophy, FaUserSecret, FaSkullCrossbones, FaCheckCircle, FaTimesCircle, FaUserPlus } from 'react-icons/fa';

const socket = io('https://catfish-game.onrender.com');

// --- Timer Bar Component ---
function TimerBar({ phase, timeLeft, duration }) {
  const percentage = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div style={styles.timerContainer}>
      <div style={styles.timerText}>
        <span>{phase.replace(/([A-Z])/g, ' $1').trim()}</span>
        <span>{minutes}:{seconds < 10 ? `0${seconds}` : seconds}</span>
      </div>
      <div style={styles.timerBar}>
        <div style={{ ...styles.timerBarProgress, width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

// --- Chat Reveal Component ---
function ChatReveal({ conversation, creatorId, onComplete }) {
  const [revealedMessages, setRevealedMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [revealedMessages, isTyping]);

  useEffect(() => {
    let isMounted = true;
    const playConversation = async () => {
      await new Promise(res => setTimeout(res, 1000));
      for (const message of conversation) {
        if (!isMounted) return;
        setIsTyping(true);
        await new Promise(res => setTimeout(res, 1500));
        if (!isMounted) return;
        setIsTyping(false);
        setRevealedMessages(prev => [...prev, message]);
        await new Promise(res => setTimeout(res, 2500));
      }
      if (!isMounted) return;
      await new Promise(res => setTimeout(res, 2000));
      onComplete();
    };

    playConversation();
    return () => { isMounted = false; };
  }, [conversation, onComplete]);

  return (
    <div style={{...styles.messagesArea, height: '250px'}}>
      {revealedMessages.map((msg, index) => (
        <div key={index} style={msg.senderId === creatorId ? styles.myMessage : styles.theirMessage}>
          {msg.text}
        </div>
      ))}
      {isTyping && <div style={styles.theirMessage}>...</div>}
      <div ref={messagesEndRef} />
    </div>
  );
}

function App() {
  // State declarations
  const [name, setName] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('Lobby');
  const [target, setTarget] = useState(null);
  const [allProfiles, setAllProfiles] = useState({});
  const [myCatfishProfile, setMyCatfishProfile] = useState(null);
  const [timer, setTimer] = useState({ phase: 'Lobby', timeLeft: 0, duration: 1 });
  const [isProfileSubmitted, setIsProfileSubmitted] = useState(false);
  const [sabotagesRemaining, setSabotagesRemaining] = useState(3);
  const [hasDecided, setHasDecided] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [fakeName, setFakeName] = useState('');
  const [likes, setLikes] = useState(['', '', '']);
  const [dislikes, setDislikes] = useState(['', '', '']);
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageSearchTerm, setImageSearchTerm] = useState('');
  const [imageResults, setImageResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [activeChat, setActiveChat] = useState('catfish');
  const [messagesAsCatfish, setMessagesAsCatfish] = useState([]);
  const [messagesAsTarget, setMessagesAsTarget] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [unreadAsCatfish, setUnreadAsCatfish] = useState(0);
  const [unreadAsTarget, setUnreadAsTarget] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const chatWindowRef = useRef(null);
  const [revealSlides, setRevealSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [finalScores, setFinalScores] = useState([]);
  const [isSabotageModalOpen, setIsSabotageModalOpen] = useState(false);
  const [sabotageTarget, setSabotageTarget] = useState(null);
  const [sabotageNewValue, setSabotageNewValue] = useState('');
  const [isFading, setIsFading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [intermissionData, setIntermissionData] = useState(null);

  // --- Smart Scrolling Logic ---
  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (!chatWindow) return;
    const isScrolledToBottom = chatWindow.scrollHeight - chatWindow.scrollTop <= chatWindow.clientHeight + 5;
    if (isScrolledToBottom) {
      chatWindow.scrollTop = chatWindow.scrollHeight;
      setShowScrollDown(false);
    } else {
      if (messagesAsCatfish.length > 0 || messagesAsTarget.length > 0) {
        setShowScrollDown(true);
      }
    }
  }, [messagesAsCatfish, messagesAsTarget]);


  // --- Socket Event Listeners ---
  useEffect(() => {
    const handlePhaseChange = (newPhase) => {
      setIsFading(true);
      setTimeout(() => {
        setGameState(newPhase);
        setIsFading(false);
      }, 300);
    };

    socket.on('tick', (serverGameState) => {
      setTimer(serverGameState);
      if (gameState !== serverGameState.phase) {
        handlePhaseChange(serverGameState.phase);
      }
    });
    socket.on('updatePlayerList', (playerList) => setPlayers(playerList));
    socket.on('gameStarted', ({ target }) => {
      setTarget(target);
      setIsProfileSubmitted(false);
      setSabotagesRemaining(3);
      setHasDecided(false);
      setHasVoted(false);
      setMessagesAsCatfish([]);
      setMessagesAsTarget([]);
      setUnreadAsCatfish(0);
      setUnreadAsTarget(0);
      setFakeName('');
      setLikes(['', '', '']);
      setDislikes(['', '', '']);
      setBio('');
      setImageUrl('');
      setImageResults([]);
      setImageSearchTerm('');
    });
    socket.on('startSabotage', (profiles) => setAllProfiles(profiles));
    socket.on('startChat', ({ catfishProfile }) => setMyCatfishProfile(catfishProfile));
    socket.on('imageResults', (images) => {
      setImageResults(images);
      setIsSearching(false);
    });
    socket.on('profilesUpdated', (updatedProfiles) => setAllProfiles(updatedProfiles));
    socket.on('receiveMessage', ({ senderId, text }) => {
      const newMessage = { senderId, text };
      if (target && senderId === target.id) {
        setMessagesAsCatfish(prev => [...prev, newMessage]);
        if (activeChat !== 'catfish') setUnreadAsCatfish(prev => prev + 1);
      } else if (myCatfishProfile && senderId === myCatfishProfile.creatorId) {
        setMessagesAsTarget(prev => [...prev, newMessage]);
        if (activeChat !== 'target') setUnreadAsTarget(prev => prev + 1);
      }
    });
    socket.on('startReveal', (results) => {
      const { players, targetAssignments, catfishProfiles, playerDecisions, allMessages, roundScores, sabotageActions } = results;
      const slides = [];
      const revealedConversations = new Set();
      players.forEach(player => {
        const creator = player;
        const targetId = targetAssignments[creator.id];
        const targetPlayer = players.find(p => p.id === targetId);
        const catfishProfile = catfishProfiles[creator.id];
        const decision = playerDecisions[targetId];
        slides.push({ type: 'intro', creatorName: creator.name, targetName: targetPlayer.name });
        slides.push({ type: 'profile', profile: catfishProfile });
        
        const sabotagesOnThisProfile = sabotageActions[creator.id] || [];
        sabotagesOnThisProfile.forEach(sabotageInfo => {
          slides.push({ type: 'sabotageReveal', sabotageInfo });
        });

        const convoKey1 = `${creator.id}-${targetId}`;
        const convoKey2 = `${targetId}-${creator.id}`;
        if (!revealedConversations.has(convoKey1)) {
          const conversationMessages = allMessages.filter(
            msg => (msg.senderId === creator.id && msg.recipientId === targetId) || (msg.senderId === targetId && msg.recipientId === creator.id)
          );
          if (conversationMessages.length > 0) {
            slides.push({ type: 'chatPlayback', conversation: conversationMessages, creatorId: creator.id });
          }
          revealedConversations.add(convoKey1);
          revealedConversations.add(convoKey2);
        }
        slides.push({ type: 'decision', targetName: targetPlayer.name, decision });
        const score = roundScores[creator.id] || 0;
        slides.push({ type: 'score', creatorName: creator.name, score });
      });
      slides.push({ type: 'voting', players });
      setRevealSlides(slides);
      setCurrentSlideIndex(0);
      handlePhaseChange('Reveal');
    });
    socket.on('startIntermission', (data) => {
      setIntermissionData(data);
      handlePhaseChange('Intermission');
    });
    socket.on('gameOver', ({ players }) => {
      setFinalScores(players);
      handlePhaseChange('GameOver');
    });
    socket.on('gameEnded', () => {
      handlePhaseChange('Lobby');
      setTimer({ phase: 'Lobby', timeLeft: 0, duration: 1 });
    });

    return () => {
      socket.off('tick');
      socket.off('updatePlayerList');
      socket.off('gameStarted');
      socket.off('startSabotage');
      socket.off('startChat');
      socket.off('imageResults');
      socket.off('profilesUpdated');
      socket.off('receiveMessage');
      socket.off('startReveal');
      socket.off('startIntermission');
      socket.off('gameOver');
      socket.off('gameEnded');
    };
  }, [gameState, target, myCatfishProfile, activeChat]);

  // Slideshow & Intermission Timers
  const advanceSlide = () => setCurrentSlideIndex(prev => prev + 1);
  useEffect(() => {
    if (gameState === 'Reveal' && revealSlides[currentSlideIndex]?.type !== 'chatPlayback' && currentSlideIndex < revealSlides.length - 1) {
      const timer = setTimeout(advanceSlide, 4000);
      return () => clearTimeout(timer);
    }
    if (gameState === 'Intermission') {
      const timer = setTimeout(() => {
        // Only the host should request the next round to avoid duplicates
        if (players.length > 0 && socket.id === players[0].id) {
            socket.emit('requestNextRound');
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentSlideIndex, revealSlides, players]);

  // --- Handler Functions ---
  const handleJoinLobby = () => { if (name.trim() !== '') socket.emit('joinLobby', name) };
  const handleStartGame = () => { if (players.length >= 2) socket.emit('startGame') };
  const handleLikeChange = (index, value) => { const newLikes = [...likes]; newLikes[index] = value; setLikes(newLikes); };
  const handleDislikeChange = (index, value) => { const newDislikes = [...dislikes]; newDislikes[index] = value; setDislikes(newDislikes); };
  const handleProfileSubmit = (e) => { e.preventDefault(); if (!imageUrl) { alert('Please select a profile picture!'); return; } socket.emit('submitProfile', { fakeName, likes, dislikes, bio, imageUrl }); setIsProfileSubmitted(true); };
  const handleImageSearch = (e) => { e.preventDefault(); if (imageSearchTerm.trim() !== '') { setIsSearching(true); setImageResults([]); socket.emit('searchImages', imageSearchTerm); } };
  const handleFileSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { const result = e.target.result; if (isSabotageModalOpen) { setSabotageNewValue(result); } else { setImageUrl(result); } }; reader.readAsDataURL(file); } };
  const handleUploadClick = () => { fileInputRef.current.click(); };
  const handleSabotage = (targetCreatorId, field, oldValue, index = null) => { if (sabotagesRemaining <= 0) return; setSabotageTarget({ targetCreatorId, field, index, oldValue }); setIsSabotageModalOpen(true); };
  const handleConfirmSabotage = (e) => { e.preventDefault(); if (sabotageNewValue.trim() !== '') { socket.emit('sabotageAction', { ...sabotageTarget, newValue: sabotageNewValue }); setSabotagesRemaining(prev => prev - 1); } setIsSabotageModalOpen(false); setSabotageNewValue(''); setSabotageTarget(null); };
  const handleSendMessage = (e) => { e.preventDefault(); if (currentMessage.trim() === '') return; if ((activeChat === 'catfish' && !target) || (activeChat === 'target' && !myCatfishProfile)) { return; } const recipientId = activeChat === 'catfish' ? target.id : myCatfishProfile.creatorId; const messageData = { senderId: socket.id, text: currentMessage }; if (activeChat === 'catfish') { setMessagesAsCatfish(prev => [...prev, messageData]); } else { setMessagesAsTarget(prev => [...prev, messageData]); } socket.emit('sendMessage', { recipientId, text: currentMessage }); setCurrentMessage(''); };
  const handleDecision = (decision) => { socket.emit('submitDecision', { decision }); setHasDecided(true); };
  const handleVote = (votedForId) => { if (!hasVoted) { socket.emit('submitVote', { votedForId }); setHasVoted(true); } };
  const handlePlayAgain = () => { socket.emit('joinLobby', name); setGameState('Lobby'); setCurrentSlideIndex(0); setRevealSlides([]); setFinalScores([]); };
  const handleSetActiveChat = (chatType) => { setActiveChat(chatType); if (chatType === 'catfish') setUnreadAsCatfish(0); if (chatType === 'target') setUnreadAsTarget(0); };
  const handleScrollDown = () => { chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight; setShowScrollDown(false); };

  // --- Main Render ---
  return (
    <div style={styles.app}>
      {isModalOpen && (<div style={styles.modalOverlay}><div style={styles.modalContent}><h3>Select a Picture</h3>{isSearching ? <p>Searching...</p> : imageResults.length > 0 ? <div style={styles.imageResultsGrid}>{imageResults.map(img => (<img key={img.id} src={img.url} alt="search result" style={styles.imageResultItem} onClick={() => { setImageUrl(img.url); setIsModalOpen(false); }} />))}</div> : <p>No results found.</p>}<button style={{...styles.button, marginTop: '15px'}} onClick={() => setIsModalOpen(false)}>Close</button></div></div>)}
      {isSabotageModalOpen && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleConfirmSabotage} style={{...styles.modalContent, gap: '10px', display: 'flex', flexDirection: 'column'}}>
            <h3>Sabotage This!</h3>
            <p><strong>Original:</strong> "{sabotageTarget.field === 'imageUrl' ? 'Profile Picture' : sabotageTarget.oldValue}"</p>
            {sabotageTarget.field === 'imageUrl' ? (
              <div style={styles.imageSearchContainer}>
                <div style={styles.imagePreview}>
                  {sabotageNewValue ? <img src={sabotageNewValue} alt="Selected" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : 'Select a Pic'}
                </div>
                <div style={{width: '100%', display: 'flex', gap: '5px'}}>
                  <input type="text" placeholder="Search online..." value={imageSearchTerm} onChange={e => setImageSearchTerm(e.target.value)} style={{...styles.input, width: '50%'}} onKeyDown={(e) => { if (e.key === 'Enter') handleImageSearch(e); }} />
                  <button type="button" onClick={handleImageSearch} style={{...styles.button, width: '25%'}}><FaSearch/></button>
                  <button type="button" onClick={handleUploadClick} style={{...styles.button, width: '25%', background: '#6c757d'}}><FaUpload/></button>
                </div>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/png, image/jpeg" />
                {isSearching ? <p>Searching...</p> : imageResults.length > 0 ? <div style={styles.imageResultsGrid}>{imageResults.map(img => (<img key={img.id} src={img.url} alt="search result" style={styles.imageResultItem} onClick={() => { setSabotageNewValue(img.url); }} />))}</div> : <p>Search for images to select one.</p>}
              </div>
            ) : (
              <input type="text" value={sabotageNewValue} onChange={(e) => setSabotageNewValue(e.target.value)} placeholder="Enter new value..." style={styles.input} autoFocus />
            )}
            <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
              <button type="submit" style={styles.button}>Confirm</button>
              <button type="button" style={{...styles.button, background: '#6c757d'}} onClick={() => setIsSabotageModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      
      <div style={{...styles.mainContainer, opacity: isFading ? 0 : 1 }}>
        <div style={{ paddingBottom: '60px' }}>
          {(() => {
            switch (gameState) {
              case 'Intermission':
                return (
                  <div style={styles.container}>
                    <h1>Round {intermissionData?.round}</h1>
                    <div style={{...styles.card, margin: '20px auto'}}>
                      <h2 style={{textAlign: 'center'}}>Current Scores</h2>
                      {intermissionData?.players.sort((a,b) => b.score - a.score).map((p) => (
                        <p key={p.id} style={{fontSize: '1.5em', margin: '10px 0', color: styles.colors.text}}>
                          {p.name}: <strong>{p.score}</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              case 'GameOver':
                return (
                  <div style={styles.container}>
                    <h1>Game Over!</h1>
                    <div style={{...styles.card, margin: '20px auto'}}>
                      <h2 style={{textAlign: 'center'}}>Final Results</h2>
                      {finalScores.sort((a,b) => b.score - a.score).map((p, index) => (
                        <p key={p.id} style={{fontSize: '1.5em', margin: '10px 0', color: styles.colors.text}}>
                          {index === 0 ? <FaTrophy style={{color: '#f1c40f', marginRight: '10px'}}/> : ''} {p.name}: <strong>{p.score}</strong>
                        </p>
                      ))}
                      <button onClick={handlePlayAgain} style={{...styles.button, marginTop: '20px', width: '100%'}}>Play Again</button>
                    </div>
                  </div>
                );
              case 'Reveal':
                const slide = revealSlides[currentSlideIndex];
                if (!slide) return <div style={styles.container}><h1>Loading Reveal...</h1></div>;
                if (slide.type === 'voting') {
                  if (hasVoted) return <div style={styles.container}><h1>Vote Cast!</h1><p>Waiting for other players to vote...</p></div>;
                  return (
                    <div style={styles.container}>
                      <h1>Vote for the Best Catfish!</h1>
                      <p>Each vote a player receives is worth 200 points.</p>
                      <div style={{marginTop: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px'}}>
                        {slide.players.filter(p => p.id !== socket.id).map(p => (
                          <button key={p.id} onClick={() => handleVote(p.id)} style={{...styles.button, padding: '20px', fontSize: '1.2em'}}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={styles.container}>
                    <h1>The Reveal</h1>
                    <div style={{...styles.card, margin: '20px auto', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                      {slide.type === 'intro' && <h2>{slide.creatorName} was trying to catfish... <strong>{slide.targetName}!</strong></h2>}
                      {slide.type === 'profile' && <div><h3>They created this profile:</h3><div style={{display: 'flex', alignItems: 'center'}}><img src={slide.profile.imageUrl} alt={slide.profile.fakeName} style={styles.profilePic} /><h4>{slide.profile.fakeName}</h4></div><p><strong>Bio:</strong> {slide.profile.bio}</p><p><strong>Likes:</strong> {slide.profile.likes.join(', ')}</p><p><strong>Dislikes:</strong> {slide.profile.dislikes.join(', ')}</p></div>}
                      {slide.type === 'sabotageReveal' && <div><h3><FaSkullCrossbones style={{marginRight: '10px'}}/>But wait, there was sabotage!</h3><p><strong>{slide.sabotageInfo.sabotagerName}</strong> changed the <strong>{slide.sabotageInfo.field}</strong> from "{slide.sabotageInfo.oldValue}" to "{slide.sabotageInfo.newValue}"!</p></div>}
                      {slide.type === 'chatPlayback' && <ChatReveal conversation={slide.conversation} creatorId={slide.creatorId} onComplete={advanceSlide} />}
                      {slide.type === 'decision' && <div><h2>{slide.targetName}'s decision was...</h2><h1 style={{color: slide.decision === 'agree' ? styles.colors.success : styles.colors.danger}}>{(slide.decision || 'no decision').toUpperCase()}!</h1></div>}
                      {slide.type === 'score' && <h2>{slide.creatorName} gets <strong style={{color: styles.colors.accent}}>{slide.score}</strong> points for that!</h2>}
                    </div>
                  </div>
                );
              case 'Decision':
                if (hasDecided) return <div style={styles.container}><h1>Decision Locked In!</h1><p>Waiting for the timer...</p></div>;
                return (
                  <div style={styles.container}>
                    <h1>The Decision</h1>
                    <p>After chatting with "{myCatfishProfile?.fakeName}", do you agree to a date?</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
                      <button onClick={() => handleDecision('agree')} style={{ ...styles.button, background: styles.colors.success, padding: '20px 40px', fontSize: '1.5em' }}><FaCheckCircle style={{marginRight: '10px'}}/> AGREE</button>
                      <button onClick={() => handleDecision('reject')} style={{ ...styles.button, background: styles.colors.danger, padding: '20px 40px', fontSize: '1.5em' }}><FaTimesCircle style={{marginRight: '10px'}}/> REJECT</button>
                    </div>
                  </div>
                );
              case 'Chat':
                const currentChatMessages = activeChat === 'catfish' ? messagesAsCatfish : messagesAsTarget;
                const chatPartnerName = activeChat === 'catfish' ? (target?.name) : (myCatfishProfile?.fakeName);
                return (
                  <div style={styles.container}>
                    <h1>Mingle & Chat</h1>
                    <div style={styles.chatContainer}>
                      <div style={styles.chatTabs}>
                        <button onClick={() => handleSetActiveChat('catfish')} style={activeChat === 'catfish' ? styles.activeTab : styles.tab}>
                          Chat with Target ({target?.name}) {unreadAsCatfish > 0 && <span style={styles.unreadBadge}>{unreadAsCatfish}</span>}
                        </button>
                        <button onClick={() => handleSetActiveChat('target')} style={activeChat === 'target' ? styles.activeTab : styles.tab}>
                          Chat with Catfish ({myCatfishProfile?.fakeName}) {unreadAsTarget > 0 && <span style={styles.unreadBadge}>{unreadAsTarget}</span>}
                        </button>
                      </div>
                      <div style={styles.chatWindow}>
                        <div style={styles.chatHeader}>
                          {activeChat === 'target' && myCatfishProfile?.imageUrl && (
                            <img src={myCatfishProfile.imageUrl} alt={myCatfishProfile.fakeName} style={styles.chatHeaderPic} />
                          )}
                          <span>Talking to: {chatPartnerName}</span>
                        </div>
                        <div ref={chatWindowRef} style={styles.messagesArea} onScroll={() => {
                            const cw = chatWindowRef.current;
                            if (cw.scrollHeight - cw.scrollTop <= cw.clientHeight + 5) setShowScrollDown(false);
                          }}>
                          {currentChatMessages.map((msg, index) => (
                            <div key={index} style={msg.senderId === socket.id ? styles.myMessage : styles.theirMessage}>{msg.text}</div>
                          ))}
                        </div>
                        {showScrollDown && <button onClick={handleScrollDown} style={styles.scrollDownButton}>↓ New Messages</button>}
                        <form onSubmit={handleSendMessage} style={styles.messageForm}>
                          <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Type a message..." style={styles.messageInput}/>
                          <button type="submit" style={styles.sendButton}>Send <FaPaperPlane style={{marginLeft: '8px'}}/></button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              case 'Sabotage':
                if (sabotagesRemaining <= 0) return <div style={styles.container}><h1>Sabotage Complete!</h1><p>You've used all your sabotages. Waiting for the timer...</p></div>;
                return (
                  <div style={styles.container}>
                    <h1><FaSkullCrossbones style={{marginRight: '10px'}}/>Sabotage! ({sabotagesRemaining} left)</h1>
                    <p>Click items on other profiles to change them.</p>
                    <div style={styles.profilesContainer}>
                      {Object.values(allProfiles).filter(p => p.creatorId !== socket.id).map(profile => (
                        <div key={profile.creatorId} style={styles.card}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <img src={profile.imageUrl} alt={profile.fakeName} style={{...styles.profilePic, width: '50px', height: '50px', cursor: 'pointer'}} onClick={() => handleSabotage(profile.creatorId, 'imageUrl', profile.imageUrl)}/>
                            <h3 style={styles.sabotageField} onClick={() => handleSabotage(profile.creatorId, 'fakeName', profile.fakeName)}>{profile.fakeName} <FaUserSecret/></h3>
                          </div>
                          <p style={styles.sabotageField} onClick={() => handleSabotage(profile.creatorId, 'bio', profile.bio)}><strong>Bio:</strong> {profile.bio}</p>
                          <p><strong>Likes:</strong></p>
                          <ul style={{ paddingLeft: '20px' }}>
                            {profile.likes.map((like, index) => (<li key={index} style={styles.sabotageField} onClick={() => handleSabotage(profile.creatorId, 'likes', like, index)}>{like}</li>))}
                          </ul>
                          <p><strong>Dislikes:</strong></p>
                          <ul style={{ paddingLeft: '20px' }}>
                            {profile.dislikes.map((dislike, index) => (<li key={index} style={styles.sabotageField} onClick={() => handleSabotage(profile.creatorId, 'dislikes', dislike, index)}>{dislike}</li>))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              case 'ProfileCreation':
                if (isProfileSubmitted) return <div style={styles.container}><h1>Profile Submitted!</h1><p>Waiting for the timer...</p></div>;
                return (
                  <div style={styles.container}>
                    <h1>Create a Profile for {target?.name}</h1>
                    <form onSubmit={handleProfileSubmit} style={styles.form}>
                      <div style={styles.imageSearchContainer}>
                        <div style={styles.imagePreview}>
                          {imageUrl ? <img src={imageUrl} alt="Selected" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : 'Select a Pic'}
                        </div>
                        <div style={{width: '100%', display: 'flex', gap: '5px'}}>
                          <input type="text" placeholder="Search online..." value={imageSearchTerm} onChange={e => setImageSearchTerm(e.target.value)} style={{...styles.input, width: '50%'}} onKeyDown={(e) => { if (e.key === 'Enter') handleImageSearch(e); }} />
                          <button type="button" onClick={handleImageSearch} style={{...styles.button, width: '25%'}}><FaSearch/></button>
                          <button type="button" onClick={handleUploadClick} style={{...styles.button, width: '25%', background: '#6c757d'}}><FaUpload/></button>
                        </div>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/png, image/jpeg" />
                      </div>
                      <input type="text" placeholder="Fake Name" value={fakeName} onChange={e => setFakeName(e.target.value)} required style={styles.input} />
                      <textarea placeholder="Fake Bio..." value={bio} onChange={e => setBio(e.target.value)} style={{...styles.input, height: '80px', resize: 'vertical'}} />
                      <p>3 Likes:</p>
                      <input type="text" placeholder="Like #1" value={likes[0]} onChange={e => handleLikeChange(0, e.target.value)} required style={styles.input} />
                      <input type="text" placeholder="Like #2" value={likes[1]} onChange={e => handleLikeChange(1, e.target.value)} required style={styles.input} />
                      <input type="text" placeholder="Like #3" value={likes[2]} onChange={e => handleLikeChange(2, e.target.value)} required style={styles.input} />
                      <p>3 Dislikes:</p>
                      <input type="text" placeholder="Dislike #1" value={dislikes[0]} onChange={e => handleDislikeChange(0, e.target.value)} required style={styles.input} />
                      <input type="text" placeholder="Dislike #2" value={dislikes[1]} onChange={e => handleDislikeChange(1, e.target.value)} required style={styles.input} />
                      <input type="text" placeholder="Dislike #3" value={dislikes[2]} onChange={e => handleDislikeChange(2, e.target.value)} required style={styles.input} />
                      <button type="submit" style={{...styles.button, width: '100%', marginTop: '10px'}}>Submit Profile</button>
                    </form>
                  </div>
                );
              case 'Assignment':
                return (
                  <div style={styles.container}>
                    <h1>The Assignment</h1>
                    <p style={{ fontSize: '1.2em' }}>Your target is...</p>
                    <div style={styles.targetBox}><h2 style={{ margin: 0 }}>{target?.name}</h2></div>
                  </div>
                );
              case 'Lobby':
              default:
                if (!players.some(p => p.id === socket.id)) {
                  return (
                    <div style={styles.container}>
                      <h1>Join the Catfish Lobby</h1>
                      <form onSubmit={(e) => {e.preventDefault(); handleJoinLobby();}} style={styles.form}>
                        <input type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
                        <button type="submit" style={styles.button}>Join Game <FaUserPlus style={{marginLeft: '8px'}}/></button>
                      </form>
                    </div>
                  );
                }
                return (
                  <div style={styles.container}>
                    <h1>Welcome to the Lobby, {name}!</h1>
                    <h3>Players Waiting ({players.length}):</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {players.map((p) => (
                        <li key={p.id} style={styles.playerListItem}>
                          {p.id === socket.id ? `(You) ${p.name}` : p.name} <span style={{color: '#888'}}>({p.score} pts)</span>
                        </li>
                      ))}
                    </ul>
                    {players.length > 0 && players[0].id === socket.id && (<button onClick={handleStartGame} disabled={players.length < 2} style={styles.button}>Start Game</button>)}
                    {players.length < 2 && players.length > 0 && players[0].id === socket.id && <p>Need at least 2 players to start.</p>}
                  </div>
                );
            }
          })()}
        </div>
      </div>
      {gameState !== 'Lobby' && gameState !== 'Reveal' && gameState !== 'GameOver' && (
        <TimerBar phase={timer.phase} timeLeft={timer.timeLeft} duration={timer.duration} />
      )}
    </div>
  );
}

const colors = {
  background: '#1a202c',
  surface: '#2d3748',
  primary: '#4299e1',
  success: '#38a169',
  danger: '#e53e3e',
  accent: '#f1c40f',
  text: '#e2e8f0',
  textMuted: '#a0aec0',
};

const styles = {
  app: {
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: "'Poppins', sans-serif",
    minHeight: '100vh',
  },
  container: { textAlign: 'center', marginTop: '40px', padding: '0 20px' },
  mainContainer: { transition: 'opacity 0.3s ease-in-out' },
  form: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '350px', margin: '0 auto' },
  input: { padding: '12px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', border: `1px solid ${colors.surface}`, backgroundColor: '#4a5568', color: colors.text },
  button: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', fontSize: '1em', cursor: 'pointer', border: 'none', borderRadius: '8px', backgroundColor: colors.primary, color: 'white', fontWeight: 'bold', transition: 'transform 0.2s ease, background-color 0.2s ease', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
  targetBox: { margin: '20px auto', padding: '20px', background: `linear-gradient(135deg, ${colors.primary}, #2b6cb0)`, borderRadius: '12px', width: '250px', boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)' },
  playerListItem: { margin: '8px 0', padding: '15px', background: colors.surface, borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
  profilesContainer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', marginTop: '20px' },
  card: { textAlign: 'left', border: `1px solid ${colors.surface}`, borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '400px', background: colors.surface, boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)' },
  sabotageField: { cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: 'background-color 0.2s', margin: '4px 0' },
  chatContainer: { position: 'relative', display: 'flex', flexDirection: 'column', border: `1px solid ${colors.surface}`, borderRadius: '12px', width: '90%', maxWidth: '600px', margin: '20px auto', background: colors.surface, overflow: 'hidden' },
  chatTabs: { display: 'flex' },
  tab: { flex: 1, padding: '15px', border: 'none', background: '#1a202c', color: colors.textMuted, cursor: 'pointer', borderBottom: `1px solid ${colors.surface}`, position: 'relative' },
  activeTab: { flex: 1, padding: '15px', border: 'none', background: colors.surface, color: colors.text, cursor: 'pointer', borderBottom: 'none', fontWeight: 'bold', position: 'relative' },
  chatWindow: { padding: '15px' },
  chatHeader: { display: 'flex', alignItems: 'center', fontWeight: 'bold', marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${colors.background}` },
  chatHeaderPic: { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', marginRight: '10px' },
  messagesArea: { height: '300px', overflowY: 'auto', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '5px' },
  messagesAreaReveal: { height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 0' },
  myMessage: { alignSelf: 'flex-end', background: colors.primary, color: 'white', padding: '8px 12px', borderRadius: '15px 15px 0 15px', maxWidth: '70%', wordWrap: 'break-word' },
  theirMessage: { alignSelf: 'flex-start', background: '#4a5568', color: colors.text, padding: '8px 12px', borderRadius: '15px 15px 15px 0', maxWidth: '70%', wordWrap: 'break-word' },
  messageForm: { display: 'flex', gap: '10px' },
  messageInput: { flex: 1, padding: '10px', border: `1px solid ${colors.background}`, borderRadius: '8px', backgroundColor: '#1a202c', color: colors.text },
  sendButton: { padding: '10px 15px', border: 'none', background: colors.success, color: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  timerContainer: { position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: '#171923', color: 'white', padding: '10px 20px', boxSizing: 'border-box', zIndex: 100, borderTop: `1px solid ${colors.surface}` },
  timerText: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontWeight: 'bold' },
  timerBar: { width: '100%', height: '10px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '5px' },
  timerBarProgress: { height: '100%', backgroundColor: colors.accent, borderRadius: '5px', transition: 'width 0.5s linear' },
  imageSearchContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px', width: '100%' },
  imagePreview: { width: '100px', height: '100px', borderRadius: '50%', border: `2px dashed ${colors.textMuted}`, display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', overflow: 'hidden', background: colors.surface },
  imageResultsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '5px', width: '100%', maxHeight: '210px', overflowY: 'auto', marginTop: '5px' },
  imageResultItem: { width: '100%', height: '90px', objectFit: 'cover', cursor: 'pointer', borderRadius: '5px' },
  profilePic: { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: `3px solid ${colors.surface}` },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: colors.surface, color: colors.text, padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px', textAlign: 'center' },
  unreadBadge: { backgroundColor: colors.danger, color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.8em', marginLeft: '8px', },
  scrollDownButton: { position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0, 123, 255, 0.9)', color: 'white', border: 'none', borderRadius: '20px', padding: '8px 15px', cursor: 'pointer', zIndex: 10 },
};

export default App;
