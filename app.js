// 초기 데이터 및 전역 변수
const HASHTAG_SUGGESTIONS = ['#성장', '#연대', '#사랑', '#평화', '#자유', '#정의', '#창의', '#지혜', '#성실', '#감사'];
const DAILY_SUBMISSION_LIMIT = 1000000; // 사실상 무제한
let values = [];
let activeTab = 'all';

// DOM 요소
let valueForm;
let valueInput;
let hashtagSuggestions;
let submissionLimitMessage;
let valuesList;
let tabButtons;

// 로그인 모달 관련 요소들
const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const closeBtn = document.querySelector('.close-btn');
const loginForm = document.getElementById('login-form');
const signupBtn = document.querySelector('.signup-btn');

// 회원가입 관련 요소들
const signupModal = document.getElementById('signup-modal');
const signupCloseBtn = document.getElementById('signup-close-btn');
const signupForm = document.getElementById('signup-form');
const privacyModal = document.getElementById('privacy-modal');
const privacyCloseBtn = document.getElementById('privacy-close-btn');
const viewPrivacyBtn = document.getElementById('view-privacy');
const togglePasswordBtns = document.querySelectorAll('.toggle-password');
const phoneInput = document.getElementById('signup-phone');

// Firebase 참조가 초기화될 때까지 기다리는 함수
function waitForFirebase(callback) {
    console.log('Firebase 초기화 대기 중...');
    let attempts = 0;
    const maxAttempts = 50; // 5초(50 * 100ms) 후 타임아웃
    
    function checkFirebase() {
        attempts++;
        if (window.firebase) {
            console.log('Firebase 객체 감지됨:', window.firebase);
            
            // Firebase 객체의 필수 함수들이 제대로 초기화되었는지 확인
            if (typeof window.firebase.ref === 'function' && 
                typeof window.firebase.database === 'object' &&
                typeof window.firebase.get === 'function') {
                
                console.log('Firebase 함수 확인 완료. 초기화 성공');
                callback();
            } else {
                console.error('Firebase 객체는 존재하지만 필요한 함수가 없습니다:', 
                    'ref 타입:', typeof window.firebase.ref,
                    'database 타입:', typeof window.firebase.database,
                    'get 타입:', typeof window.firebase.get);
                
                if (submissionLimitMessage) {
                    submissionLimitMessage.textContent = 'Firebase 모듈 오류. 페이지를 새로고침해주세요.';
                    submissionLimitMessage.style.color = 'red';
                }
            }
        } else if (attempts >= maxAttempts) {
            console.error('Firebase 초기화 타임아웃. 페이지를 새로 고침해주세요.');
            // 타임아웃 메시지를 UI에 표시
            if (submissionLimitMessage) {
                submissionLimitMessage.textContent = 'Firebase 연결 오류. 페이지를 새로고침해주세요.';
                submissionLimitMessage.style.color = 'red';
            }
        } else {
            console.log(`Firebase 대기 중... (${attempts}/${maxAttempts})`);
            setTimeout(checkFirebase, 100);
        }
    }
    
    // Firebase 초기화 확인 시작
    checkFirebase();
}

// 초기화 함수
function init() {
    try {
        console.log('앱 초기화 시작');
        
        // DOM 요소 초기화
        initializeDOMElements();
        
        if (!valueForm || !valuesList) {
            console.error('필수 DOM 요소를 찾을 수 없음, 1초 후 다시 시도');
            setTimeout(init, 1000);
            return;
        }
        
        renderHashtagSuggestions();
        
        // Firebase가 준비되었는지 확인
        waitForFirebase(() => {
            try {
                console.log('Firebase 초기화 완료');
                loadDataFromFirebase();
                
                // 이벤트 리스너 설정
                console.log('이벤트 리스너 설정');
                valueForm.addEventListener('submit', handleValueSubmit);
                valueInput.addEventListener('input', handleValueInput);
                tabButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        activeTab = btn.dataset.tab;
                        setActiveTab(btn);
                        renderValues();
                    });
                });
                
                // Firebase 실시간 업데이트 리스너 설정
                setupFirebaseListeners();
            } catch (error) {
                console.error('Firebase 초기화 후 설정 중 오류:', error);
            }
        });
        
        console.log('앱 초기화 완료');
    } catch (error) {
        console.error('앱 초기화 중 오류:', error);
    }
}

// DOM 요소 초기화 함수
function initializeDOMElements() {
    console.log('DOM 요소 초기화 시작');
    
    // DOM 요소 초기화
    valueForm = document.getElementById('value-form');
    valueInput = document.getElementById('value-input');
    hashtagSuggestions = document.getElementById('hashtag-suggestions');
    submissionLimitMessage = document.getElementById('submission-limit-message');
    valuesList = document.getElementById('values-list');
    tabButtons = document.querySelectorAll('.tab-btn');
    
    // 요소 존재 확인
    if (!valueForm) console.error('value-form을 찾을 수 없음');
    if (!valueInput) console.error('value-input을 찾을 수 없음');
    if (!hashtagSuggestions) console.error('hashtag-suggestions를 찾을 수 없음');
    if (!submissionLimitMessage) console.error('submission-limit-message를 찾을 수 없음');
    if (!valuesList) console.error('values-list를 찾을 수 없음');
    if (!tabButtons || tabButtons.length === 0) console.error('tab-btn을 찾을 수 없음');
    
    console.log('DOM 요소 초기화 완료');
}

// Firebase 실시간 업데이트 리스너 설정
function setupFirebaseListeners() {
    try {
        console.log('Firebase 리스너 설정 시작');
        if (!window.firebase || !window.firebase.database) {
            console.error('Firebase 또는 Firebase 데이터베이스가 초기화되지 않았습니다');
            return;
        }
        
        const valuesRef = firebase.ref(firebase.database, 'values');
        console.log('valuesRef 생성됨:', valuesRef);

        // 새로운 가치관이 추가될 때
        firebase.onChildAdded(valuesRef, (snapshot) => {
            try {
                const newValue = snapshot.val();
                newValue.id = snapshot.key;
                console.log('새 가치관 추가됨:', newValue.id);
                
                // 이미 존재하는지 확인 (중복 방지)
                const existingIndex = values.findIndex(v => v.id === newValue.id);
                if (existingIndex === -1) {
                    values.unshift(newValue);
                    renderValues();
                }
            } catch (error) {
                console.error('onChildAdded 콜백 오류:', error);
            }
        });
        
        // 가치관이 업데이트될 때 (좋아요, 댓글 등)
        firebase.onChildChanged(valuesRef, (snapshot) => {
            try {
                const updatedValue = snapshot.val();
                updatedValue.id = snapshot.key;
                console.log('가치관 업데이트됨:', updatedValue.id);
                
                const existingIndex = values.findIndex(v => v.id === updatedValue.id);
                if (existingIndex !== -1) {
                    values[existingIndex] = updatedValue;
                    renderValues();
                }
            } catch (error) {
                console.error('onChildChanged 콜백 오류:', error);
            }
        });
        
        // 가치관이 삭제될 때
        firebase.onChildRemoved(valuesRef, (snapshot) => {
            try {
                const removedId = snapshot.key;
                console.log('가치관 삭제됨:', removedId);
                values = values.filter(v => v.id !== removedId);
                renderValues();
            } catch (error) {
                console.error('onChildRemoved 콜백 오류:', error);
            }
        });
        
        console.log('Firebase 리스너 설정 완료');
    } catch (error) {
        console.error('Firebase 리스너 설정 중 오류:', error);
    }
}

// Firebase에서 데이터 로드
function loadDataFromFirebase() {
    try {
        console.log('Firebase 데이터 로드 시작');
        const valuesRef = firebase.ref(firebase.database, 'values');

        firebase.get(valuesRef)
            .then(snapshot => {
                try {
                    if (snapshot.exists()) {
                        values = [];
                        snapshot.forEach(childSnapshot => {
                            const value = childSnapshot.val();
                            value.id = childSnapshot.key;
                            values.push(value);
                        });
                        
                        // 최신 항목이 먼저 나오도록 정렬
                        values.sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        console.log('Firebase에서 데이터 로드 완료:', values.length + '개 항목');
                        checkSubmissionLimit();
                        renderValues();
                    } else {
                        console.log('Firebase에 데이터가 없습니다.');
                        values = [];
                        renderValues();
                    }
                } catch (error) {
                    console.error('Firebase 데이터 처리 중 오류:', error);
                }
            })
            .catch(error => {
                console.error('Firebase 데이터 로드 오류:', error);
            });
    } catch (error) {
        console.error('Firebase 데이터 로드 시작 중 오류:', error);
    }
}

// 해시태그 제안 렌더링
function renderHashtagSuggestions() {
    console.log('해시태그 제안 렌더링');
    hashtagSuggestions.innerHTML = '';
    HASHTAG_SUGGESTIONS.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('hashtag');
        tagElement.textContent = tag;
        tagElement.addEventListener('click', () => {
            valueInput.value += ` ${tag}`;
            valueInput.focus();
        });
        hashtagSuggestions.appendChild(tagElement);
    });
}

// 입력 처리 함수
function handleValueInput(e) {
    // 필요 시 해시태그 자동 완성 로직 추가
}

// 가치관 제출 처리
function handleValueSubmit(e) {
    e.preventDefault();
    console.log('가치관 제출 처리 시작');
    
    // Firebase 초기화 확인
    if (!window.firebase || !window.firebase.database) {
        console.error('Firebase 객체가 초기화되지 않았습니다');
        submissionLimitMessage.textContent = 'Firebase 연결 오류. 페이지를 새로고침해주세요.';
        submissionLimitMessage.style.color = 'red';
        return;
    }
    
    // 사용자가 어제 날짜로 등록하려는지 확인
    const yesterdayCheckbox = document.getElementById('use-yesterday');
    const useYesterdayDate = yesterdayCheckbox ? yesterdayCheckbox.checked : false;
    
    if (!useYesterdayDate && !canSubmitToday()) {
        submissionLimitMessage.textContent = `하루 ${DAILY_SUBMISSION_LIMIT}회 한정입니다.`;
        console.log('제출 제한 초과');
        return;
    }
    
    const valueText = valueInput.value.trim();
    if (!valueText) {
        console.log('빈 입력 감지');
        return;
    }
    
    console.log('입력 텍스트:', valueText);
    
    // 해시태그 추출
    const hashtags = [];
    const words = valueText.split(' ');
    const cleanedText = words.filter(word => {
        if (word.startsWith('#')) {
            hashtags.push(word);
            return false;
        }
        return true;
    }).join(' ');
    
    console.log('추출된 해시태그:', hashtags);
    console.log('정리된 텍스트:', cleanedText);
    
    // 사용자 ID 가져오기
    const userId = getUserId();
    
    // 날짜 설정 (어제 날짜 혹은 현재 날짜)
    let submissionDate = new Date();
    if (useYesterdayDate) {
        submissionDate.setDate(submissionDate.getDate() - 1);
        console.log('어제 날짜로 등록:', submissionDate.toISOString());
    }
    
    // 가치관 객체 생성
    const newValue = {
        text: cleanedText || valueText, // 해시태그만 있는 경우 원래 텍스트 사용
        hashtags: hashtags,
        date: submissionDate.toISOString(),
        likes: 0,
        likedBy: {},
        comments: [],
        userId: userId
    };
    
    console.log('새 가치관 객체:', newValue);
    
    try {
        // Firebase에 저장 (push로 고유 key 생성!)
        const valuesRef = firebase.ref(firebase.database, 'values');
        const newValueRef = firebase.push(valuesRef); // 반드시 push 사용!
        
        console.log('데이터 저장 시도:', newValueRef);
        
        firebase.set(newValueRef, newValue)
            .then(() => {
                console.log('Firebase에 가치관 저장 성공');
                
                // 폼 리셋
                valueInput.value = '';
                if (yesterdayCheckbox) {
                    yesterdayCheckbox.checked = false;
                }
                checkSubmissionLimit();
            })
            .catch(error => {
                console.error('Firebase 저장 오류:', error);
                alert('Firebase 저장 오류: ' + error);
                submissionLimitMessage.textContent = '저장 중 오류가 발생했습니다. 다시 시도해주세요.';
            });
    } catch (error) {
        console.error('Firebase 저장 시도 중 오류:', error);
        submissionLimitMessage.textContent = '저장 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
    }
}

// 하루 제출 수 체크 (항상 true 반환)
function canSubmitToday() {
    return true;
}

// 어제 날짜 가져오기
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
}

// 어제 날짜로 작성된 가치관 가져오기
function getYesterdayValues() {
    const userId = getUserId();
    const yesterday = getYesterdayDate().toDateString();
    
    return values.filter(v => {
        try {
            const valueDate = new Date(v.date).toDateString();
            return valueDate === yesterday;
        } catch (error) {
            console.error('날짜 파싱 오류:', error, v);
            return false;
        }
    });
}

// 제출 제한 체크 및 UI 업데이트 (항상 등록 가능하게)
function checkSubmissionLimit() {
    submissionLimitMessage.textContent = '';
    valueForm.querySelector('button').disabled = false;
}

// 탭 활성화
function setActiveTab(clickedTab) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    clickedTab.classList.add('active');
}

// 가치관 렌더링
function renderValues() {
    console.log('가치관 렌더링 시작');
    valuesList.innerHTML = '';
    
    let filteredValues = [...values];
    console.log('총 가치관 수:', filteredValues.length);
    
    // 탭에 따른 필터링
    try {
        if (activeTab === 'today') {
            const today = new Date().toDateString();
            filteredValues = filteredValues.filter(v => {
                try {
                    const valueDate = new Date(v.date).toDateString();
                    return valueDate === today;
                } catch (error) {
                    console.error('날짜 파싱 오류:', error, v);
                    return false;
                }
            });
            // 오늘의 TOP 10으로 제한
            filteredValues.sort((a, b) => b.likes - a.likes);
            filteredValues = filteredValues.slice(0, 10);
            console.log('오늘 TOP 10 필터링 후:', filteredValues.length);
        } else if (activeTab === 'yesterday') {
            const yesterday = getYesterdayDate().toDateString();
            console.log('어제 날짜:', yesterday);
            filteredValues = filteredValues.filter(v => {
                try {
                    const valueDate = new Date(v.date).toDateString();
                    console.log('비교:', valueDate, yesterday, valueDate === yesterday);
                    return valueDate === yesterday;
                } catch (error) {
                    console.error('날짜 파싱 오류:', error, v);
                    return false;
                }
            });
            console.log('어제 등록 필터링 후:', filteredValues.length);
        } else if (activeTab === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            filteredValues = filteredValues.filter(v => {
                try {
                    const valueDate = new Date(v.date);
                    return valueDate >= weekAgo;
                } catch (error) {
                    console.error('날짜 파싱 오류:', error, v);
                    return false;
                }
            });
            // 좋아요순 정렬
            filteredValues.sort((a, b) => b.likes - a.likes);
            console.log('주간 필터링 후:', filteredValues.length);
        }
    } catch (error) {
        console.error('탭 필터링 중 오류 발생:', error);
    }
    
    if (filteredValues.length === 0) {
        valuesList.innerHTML = '<p class="no-values">표시할 가치관이 없습니다.</p>';
        console.log('표시할 가치관 없음');
        return;
    }
    
    try {
        filteredValues.forEach(value => {
            try {
                const cardElement = createValueCard(value);
                valuesList.appendChild(cardElement);
            } catch (error) {
                console.error('카드 생성 오류:', error, value);
            }
        });
    } catch (error) {
        console.error('카드 렌더링 중 오류 발생:', error);
    }
    
    console.log('가치관 렌더링 완료:', filteredValues.length + '개 렌더링됨');
}

// 가치관 카드 생성
function createValueCard(value) {
    console.log('카드 생성:', value.id);
    const template = document.getElementById('value-card-template');
    if (!template) {
        console.error('value-card-template을 찾을 수 없음');
        return document.createElement('div'); // 빈 요소 반환
    }
    
    const cardClone = document.importNode(template.content, true);
    
    // 카드 내용 채우기
    const card = cardClone.querySelector('.value-card');
    card.id = `value-${value.id}`;
    
    const valueText = card.querySelector('.value-text');
    valueText.textContent = value.text;
    
    const hashtagsContainer = card.querySelector('.value-hashtags');
    if (value.hashtags && Array.isArray(value.hashtags)) {
        value.hashtags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.classList.add('hashtag');
            tagElement.textContent = tag;
            hashtagsContainer.appendChild(tagElement);
        });
    }
    
    const dateElement = card.querySelector('.value-date');
    dateElement.textContent = formatDate(value.date);
    
    // 좋아요 버튼 설정
    const likeBtn = card.querySelector('.like-btn');
    const likeCount = likeBtn.querySelector('.like-count');
    likeCount.textContent = value.likes || 0;
    
    // 사용자가 이미 좋아요 했는지 확인
    const userId = getUserId();
    if (value.likedBy && value.likedBy[userId]) {
        likeBtn.classList.add('liked');
    }
    
    // 좋아요 이벤트 설정
    likeBtn.addEventListener('click', () => {
        handleLike(value.id);
    });
    
    // 댓글 버튼 설정
    const commentBtn = card.querySelector('.comment-btn');
    const commentsSection = card.querySelector('.comments-section');
    
    commentBtn.addEventListener('click', () => {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        
        if (commentsSection.style.display === 'block') {
            renderComments(value.id, commentsSection.querySelector('.comments-list'));
        }
    });
    
    // 댓글 입력 이벤트 설정
    const commentInput = commentsSection.querySelector('.comment-text');
    const postCommentBtn = commentsSection.querySelector('.post-comment-btn');
    
    postCommentBtn.addEventListener('click', () => {
        const commentText = commentInput.value.trim();
        if (commentText) {
            addComment(value.id, commentText);
            commentInput.value = '';
        }
    });
    
    // 리액션 버튼 이벤트 설정
    const reactionBtns = commentsSection.querySelectorAll('.reaction-btn');
    reactionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            addComment(value.id, emoji);
        });
    });

    // 내가 쓴 글에만 지우기 버튼 보이기
    const deleteBtn = card.querySelector('.delete-btn');
    if (value.userId === userId) {
        deleteBtn.style.display = '';
        deleteBtn.onclick = () => {
            if (confirm('정말로 이 가치관을 삭제하시겠습니까?')) {
                // 반드시 해당 value만 삭제
                const valueRef = firebase.ref(firebase.database, `values/${value.id}`);
                firebase.remove(valueRef)
                    .then(() => {
                        console.log('가치관 삭제 성공:', value.id);
                    })
                    .catch(error => {
                        console.error('가치관 삭제 오류:', error);
                        alert('삭제 중 오류가 발생했습니다.');
                    });
            }
        };
    } else {
        deleteBtn.style.display = 'none';
    }

    return card;
}

// 좋아요 처리
function handleLike(valueId) {
    const userId = getUserId();
    
    // Firebase에서 현재 value 상태 가져오기
    const valueRef = firebase.ref(firebase.database, `values/${valueId}`);
    
    firebase.get(valueRef)
        .then(snapshot => {
            if (snapshot.exists()) {
                const value = snapshot.val();
                
                // likedBy 객체가 없으면 초기화
                if (!value.likedBy) value.likedBy = {};
                
                // 좋아요 처리
                const alreadyLiked = value.likedBy[userId];
                
                if (alreadyLiked) {
                    // 좋아요 취소
                    value.likes = Math.max(0, (value.likes || 0) - 1);
                    delete value.likedBy[userId];
                    console.log('좋아요 취소:', valueId);
                } else {
                    // 좋아요 추가
                    value.likes = (value.likes || 0) + 1;
                    value.likedBy[userId] = true;
                    console.log('좋아요 추가:', valueId);
                }
                
                // Firebase 업데이트
                return firebase.update(valueRef, {
                    likes: value.likes,
                    likedBy: value.likedBy
                });
            } else {
                console.error('좋아요 처리 실패: 해당 ID의 가치관을 찾을 수 없음', valueId);
            }
        })
        .catch(error => {
            console.error('좋아요 처리 중 오류:', error);
        });
}

// 댓글 추가
function addComment(valueId, commentText) {
    const userId = getUserId();
    
    // Firebase에서 현재 댓글 목록 가져오기
    const valueRef = firebase.ref(firebase.database, `values/${valueId}`);
    
    firebase.get(valueRef)
        .then(snapshot => {
            if (snapshot.exists()) {
                const value = snapshot.val();
                
                // comments 배열이 없으면 초기화
                let comments = value.comments || [];
                
                // 새 댓글 객체 생성
                const newComment = {
                    id: Date.now().toString(),
                    text: commentText,
                    userId: userId,
                    date: new Date().toISOString()
                };
                
                // 댓글 추가
                comments.push(newComment);
                
                // Firebase 업데이트
                return firebase.update(valueRef, { comments });
            } else {
                console.error('댓글 추가 실패: 해당 ID의 가치관을 찾을 수 없음', valueId);
            }
        })
        .then(() => {
            console.log('댓글 추가 성공:', valueId, commentText);
            // 댓글 섹션 다시 렌더링
            const commentsSection = document.querySelector(`#value-${valueId} .comments-section`);
            if (commentsSection && commentsSection.style.display !== 'none') {
                renderComments(valueId, commentsSection.querySelector('.comments-list'));
            }
        })
        .catch(error => {
            console.error('댓글 추가 중 오류:', error);
        });
}

// 댓글 렌더링
function renderComments(valueId, commentsListElement) {
    // Firebase에서 최신 댓글 데이터 가져오기
    const valueRef = firebase.ref(firebase.database, `values/${valueId}`);
    
    firebase.get(valueRef)
        .then(snapshot => {
            if (snapshot.exists()) {
                const value = snapshot.val();
                const comments = value.comments || [];
                commentsListElement.innerHTML = '';
                
                if (comments.length === 0) {
                    commentsListElement.innerHTML = '<p class="no-comments">아직 댓글이 없습니다.</p>';
                    return;
                }
                
                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.classList.add('comment');
                    
                    const commentText = document.createElement('div');
                    commentText.classList.add('comment-text');
                    commentText.textContent = comment.text;
                    
                    const commentDate = document.createElement('div');
                    commentDate.classList.add('comment-date');
                    commentDate.textContent = formatDate(comment.date);
                    
                    commentElement.appendChild(commentText);
                    commentElement.appendChild(commentDate);
                    commentsListElement.appendChild(commentElement);
                });
            } else {
                console.error('댓글 렌더링 실패: 해당 ID의 가치관을 찾을 수 없음', valueId);
            }
        })
        .catch(error => {
            console.error('댓글 렌더링 중 오류:', error);
            commentsListElement.innerHTML = '<p class="no-comments">댓글을 불러오는 중 오류가 발생했습니다.</p>';
        });
}

// 사용자 ID 가져오기 (로컬 스토리지에 저장된 임의의 ID)
function getUserId() {
    let userId = localStorage.getItem('userId');
    
    if (!userId) {
        userId = 'user_' + Date.now().toString();
        localStorage.setItem('userId', userId);
        console.log('새 사용자 ID 생성:', userId);
    }
    
    return userId;
}

// 날짜 포맷팅
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) {
            return '방금 전';
        } else if (diffMins < 60) {
            return `${diffMins}분 전`;
        } else if (diffHours < 24) {
            return `${diffHours}시간 전`;
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
        }
    } catch (error) {
        console.error('날짜 포맷팅 오류:', error, dateString);
        return '날짜 오류';
    }
}

// 로그인 모달 열기
loginBtn.addEventListener('click', () => {
    loginModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
});

// 로그인 모달 닫기
closeBtn.addEventListener('click', () => {
    loginModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // 배경 스크롤 복원
});

// 모달 외부 클릭시 닫기
window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// 로그인 폼 제출 처리
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // Firebase Authentication을 사용한 로그인 처리
        const userCredential = await firebase.signInWithEmailAndPassword(email, password);
        console.log('로그인 성공:', userCredential.user);
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // 로그인 성공 후 UI 업데이트
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그아웃';
        loginBtn.onclick = () => {
            firebase.signOut().then(() => {
                console.log('로그아웃 성공');
                loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그인';
                loginBtn.onclick = () => {
                    loginModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                };
            }).catch((error) => {
                console.error('로그아웃 실패:', error);
            });
        };
    } catch (error) {
        console.error('로그인 실패:', error);
        alert('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    }
});

// 회원가입 모달 열기
signupBtn.addEventListener('click', () => {
    loginModal.style.display = 'none';
    signupModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
});

// 회원가입 모달 닫기
signupCloseBtn.addEventListener('click', () => {
    signupModal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

// 개인정보처리방침 모달 열기/닫기
viewPrivacyBtn.addEventListener('click', () => {
    privacyModal.style.display = 'block';
});

privacyCloseBtn.addEventListener('click', () => {
    privacyModal.style.display = 'none';
});

// 모달 외부 클릭시 닫기
window.addEventListener('click', (e) => {
    if (e.target === signupModal) {
        signupModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else if (e.target === privacyModal) {
        privacyModal.style.display = 'none';
    }
});

// 비밀번호 보기/숨기기 토글
togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

// 전화번호 자동 하이픈 추가
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    if (value.length > 3 && value.length <= 7) {
        value = value.slice(0, 3) + '-' + value.slice(3);
    } else if (value.length > 7) {
        value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
    }
    
    e.target.value = value;
});

// 회원가입 폼 제출 처리
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const privacyAgreement = document.getElementById('privacy-agreement').checked;

    // 유효성 검사
    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    if (!privacyAgreement) {
        alert('개인정보 수집 및 이용에 동의해주세요.');
        return;
    }

    // 비밀번호 복잡도 검사
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        alert('비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 포함해야 합니다.');
        return;
    }

    try {
        // Firebase Authentication을 사용한 회원가입
        const userCredential = await firebase.createUserWithEmailAndPassword(email, password);
        
        // 추가 사용자 정보를 Firebase Realtime Database에 저장
        const userId = userCredential.user.uid;
        const userRef = firebase.ref(firebase.database, `users/${userId}`);
        
        await firebase.set(userRef, {
            name,
            email,
            phone,
            createdAt: new Date().toISOString()
        });

        alert('회원가입이 완료되었습니다.');
        signupModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        signupForm.reset();
        
        // 회원가입 성공 후 자동 로그인 상태 UI 업데이트
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그아웃';
        loginBtn.onclick = () => {
            firebase.signOut().then(() => {
                console.log('로그아웃 성공');
                loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그인';
                loginBtn.onclick = () => {
                    loginModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                };
            }).catch((error) => {
                console.error('로그아웃 실패:', error);
            });
        };
        
    } catch (error) {
        console.error('회원가입 실패:', error);
        alert('회원가입에 실패했습니다. ' + error.message);
    }
});

// 로그인 상태 감지
firebase.auth.onAuthStateChanged((user) => {
    const loginBtn = document.getElementById('login-btn');
    if (user) {
        // 로그인 상태
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그아웃';
        loginBtn.onclick = () => {
            firebase.signOut().then(() => {
                console.log('로그아웃 성공');
                loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그인';
                loginBtn.onclick = () => {
                    loginModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                };
            }).catch((error) => {
                console.error('로그아웃 실패:', error);
            });
        };
    } else {
        // 로그아웃 상태
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 로그인';
        loginBtn.onclick = () => {
            loginModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        };
    }
});

// 앱 초기화 - DOMContentLoaded 이벤트에 연결
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded 이벤트 발생, 앱 초기화 시작');
    // 약간의 지연을 두고 초기화 (모든 DOM이 완전히 로드되도록)
    setTimeout(init, 500);
}); 