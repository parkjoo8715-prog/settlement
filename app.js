const NEW_MEMBER_ADVANCE = 30000;
const STORAGE_KEY = "settlement-system-prototype-v5";

const ACCOUNT_INSTITUTION_GROUPS = [
  {
    label: "시중은행",
    options: [
      "KB국민은행",
      "신한은행",
      "하나은행",
      "우리은행",
      "NH농협은행",
      "IBK기업은행",
      "SC제일은행",
      "한국씨티은행",
    ],
  },
  {
    label: "인터넷은행",
    options: ["카카오뱅크", "케이뱅크", "토스뱅크"],
  },
  {
    label: "지방/특수은행",
    options: [
      "BNK부산은행",
      "iM뱅크",
      "BNK경남은행",
      "광주은행",
      "전북은행",
      "제주은행",
      "Sh수협은행",
      "한국산업은행",
      "한국수출입은행",
      "우체국예금",
    ],
  },
  {
    label: "상호금융/기타",
    options: ["새마을금고", "신협", "저축은행", "산림조합", "농축협"],
  },
  {
    label: "증권사",
    options: [
      "미래에셋증권",
      "삼성증권",
      "한국투자증권",
      "NH투자증권",
      "KB증권",
      "키움증권",
      "신한투자증권",
      "하나증권",
      "대신증권",
      "메리츠증권",
      "토스증권",
      "유안타증권",
    ],
  },
];

const ROUND_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const state = {
  hostName: "",
  accountType: "",
  accountNumber: "",
  guests: [],
  rounds: [],
};

let guestSequence = 1;
let roundSequence = 1;

const dom = {
  hostNameInput: document.querySelector("#hostNameInput"),
  accountTypeSelect: document.querySelector("#accountTypeSelect"),
  accountNumberInput: document.querySelector("#accountNumberInput"),
  guestForm: document.querySelector("#guestForm"),
  guestNameInput: document.querySelector("#guestNameInput"),
  guestList: document.querySelector("#guestList"),
  addRoundBtn: document.querySelector("#addRoundBtn"),
  roundEditors: document.querySelector("#roundEditors"),
  summaryCards: document.querySelector("#summaryCards"),
  roundResults: document.querySelector("#roundResults"),
  totalResults: document.querySelector("#totalResults"),
  validationBox: document.querySelector("#validationBox"),
  copyFeedback: document.querySelector("#copyFeedback"),
  copyRoundSummaryBtn: document.querySelector("#copyRoundSummaryBtn"),
  copyTotalSummaryBtn: document.querySelector("#copyTotalSummaryBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  resetAllBtn: document.querySelector("#resetAllBtn"),
};

initialize();

function initialize() {
  populateAccountTypeSelect();
  restoreState();

  if (!state.rounds.length) {
    state.rounds = [createRound()];
  }

  syncRoundOrders();
  refreshSequences();
  bindEvents();
  render();
}

function populateAccountTypeSelect() {
  const groups = ACCOUNT_INSTITUTION_GROUPS.map(
    (group) => `
      <optgroup label="${group.label}">
        ${group.options
          .map(
            (option) => `
              <option value="${option}">${option}</option>
            `
          )
          .join("")}
      </optgroup>
    `
  ).join("");

  dom.accountTypeSelect.innerHTML = `
    <option value="">계좌 유형/기관 선택</option>
    ${groups}
  `;
}

function restoreState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);
    state.hostName = typeof parsed.hostName === "string" ? parsed.hostName : "";
    state.accountType = typeof parsed.accountType === "string" ? parsed.accountType : "";
    state.accountNumber = typeof parsed.accountNumber === "string" ? parsed.accountNumber : "";
    state.guests = Array.isArray(parsed.guests)
      ? parsed.guests
          .filter((guest) => guest && typeof guest.name === "string")
          .map((guest) => ({
            id: String(guest.id),
            name: guest.name,
          }))
      : [];
    state.rounds = Array.isArray(parsed.rounds)
      ? parsed.rounds
          .filter((round) => round)
          .map((round, index) => ({
            id: String(round.id ?? `round-${index + 1}`),
            cardOrder: index + 1,
            roundValue: Math.max(1, toInteger(round.roundValue) || 1),
            scheduleTitle: typeof round.scheduleTitle === "string" ? round.scheduleTitle : "",
            totalAmount: Math.max(0, toInteger(round.totalAmount)),
            attendees: Array.isArray(round.attendees)
              ? round.attendees
                  .filter((attendee) => attendee && attendee.guestId)
                  .map((attendee) => ({
                    guestId: String(attendee.guestId),
                    isNew: Boolean(attendee.isNew),
                  }))
              : [],
          }))
      : [];
  } catch (error) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hostName: state.hostName,
        accountType: state.accountType,
        accountNumber: state.accountNumber,
        guests: state.guests,
        rounds: state.rounds,
      })
    );
  } catch (error) {
    // Ignore storage failures in the prototype.
  }
}

function bindEvents() {
  dom.hostNameInput.addEventListener("input", (event) => {
    state.hostName = event.target.value;
    render();
  });

  dom.accountTypeSelect.addEventListener("change", (event) => {
    state.accountType = event.target.value;
    renderResultsOnly();
  });

  dom.accountNumberInput.addEventListener("input", (event) => {
    state.accountNumber = event.target.value;
    renderResultsOnly();
  });

  dom.guestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addGuest();
  });

  dom.guestList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-guest]");
    if (!button) {
      return;
    }

    removeGuest(button.dataset.removeGuest);
  });

  dom.addRoundBtn.addEventListener("click", () => {
    state.rounds.push(createRound());
    syncRoundOrders();
    render();
  });

  dom.roundEditors.addEventListener("input", handleRoundEditorInput);
  dom.roundEditors.addEventListener("change", handleRoundEditorInput);
  dom.roundEditors.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-round]");
    if (!button) {
      return;
    }

    removeRound(button.dataset.removeRound);
  });

  dom.copyRoundSummaryBtn.addEventListener("click", async () => {
    const calculations = calculateSettlement();
    await copyToClipboard(buildRoundSummaryText(calculations), "차수별 요약을 복사했습니다.");
  });

  dom.copyTotalSummaryBtn.addEventListener("click", async () => {
    const calculations = calculateSettlement();
    await copyToClipboard(buildTotalSummaryText(calculations), "총합 요약을 복사했습니다.");
  });

  dom.loadSampleBtn.addEventListener("click", () => {
    loadSampleData();
  });

  dom.resetAllBtn.addEventListener("click", () => {
    resetState();
  });
}

function handleRoundEditorInput(event) {
  const container = event.target.closest("[data-round-id]");
  if (!container) {
    return;
  }

  const round = state.rounds.find((item) => item.id === container.dataset.roundId);
  if (!round) {
    return;
  }

  if (event.target.matches("[data-field='scheduleTitle']")) {
    round.scheduleTitle = event.target.value;
    renderResultsOnly();
    return;
  }

  if (event.target.matches("[data-field='roundValue']")) {
    round.roundValue = Math.max(1, toInteger(event.target.value));
    render();
    return;
  }

  if (event.target.matches("[data-field='totalAmount']")) {
    round.totalAmount = Math.max(0, toInteger(event.target.value));
    renderResultsOnly();
    return;
  }

  if (event.target.matches("[data-attendee-id]")) {
    toggleRoundAttendee(round, event.target.dataset.attendeeId, event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-attendee-new-id]")) {
    const attendee = round.attendees.find((item) => item.guestId === event.target.dataset.attendeeNewId);
    if (!attendee) {
      return;
    }

    attendee.isNew = event.target.checked;
    renderResultsOnly();
  }
}

function createRound() {
  return {
    id: `round-${roundSequence++}`,
    cardOrder: state.rounds.length + 1,
    roundValue: 1,
    scheduleTitle: "",
    totalAmount: 0,
    attendees: [],
  };
}

function createGuest(name) {
  return {
    id: `guest-${guestSequence++}`,
    name,
  };
}

function refreshSequences() {
  guestSequence = getNextSequence(state.guests.map((guest) => guest.id), "guest");
  roundSequence = getNextSequence(state.rounds.map((round) => round.id), "round");
}

function getNextSequence(ids, prefix) {
  const highest = ids.reduce((max, id) => {
    const match = String(id).match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) {
      return max;
    }
    return Math.max(max, Number.parseInt(match[1], 10));
  }, 0);

  return highest + 1;
}

function syncRoundOrders() {
  state.rounds.forEach((round, index) => {
    round.cardOrder = index + 1;
  });
}

function addGuest() {
  const name = dom.guestNameInput.value.trim();

  if (!name) {
    setFeedback("참석자 닉네임을 입력해 주세요.");
    dom.guestNameInput.focus();
    return;
  }

  if (state.hostName.trim() && name === state.hostName.trim()) {
    setFeedback("벙주 닉네임과 동일한 참석자는 추가할 수 없습니다.");
    return;
  }

  if (state.guests.some((guest) => guest.name === name)) {
    setFeedback("같은 닉네임의 참석자가 이미 있습니다.");
    return;
  }

  state.guests.push(createGuest(name));
  dom.guestForm.reset();
  setFeedback("참석자를 추가했습니다.");
  render();
}

function removeGuest(guestId) {
  state.guests = state.guests.filter((guest) => guest.id !== guestId);
  state.rounds.forEach((round) => {
    round.attendees = round.attendees.filter((attendee) => attendee.guestId !== guestId);
  });
  setFeedback("참석자를 삭제했습니다.");
  render();
}

function removeRound(roundId) {
  if (state.rounds.length === 1) {
    setFeedback("최소 1개의 일정 카드는 필요합니다.");
    return;
  }

  state.rounds = state.rounds.filter((round) => round.id !== roundId);
  syncRoundOrders();
  setFeedback("일정 카드를 삭제했습니다.");
  render();
}

function toggleRoundAttendee(round, guestId, checked) {
  const index = round.attendees.findIndex((attendee) => attendee.guestId === guestId);

  if (checked && index === -1) {
    round.attendees.push({ guestId, isNew: false });
    return;
  }

  if (!checked && index >= 0) {
    round.attendees.splice(index, 1);
  }
}

function loadSampleData() {
  state.hostName = "벙주민트";
  state.accountType = "카카오뱅크";
  state.accountNumber = "3333-12-1234567";
  state.guests = [
    createGuest("리버"),
    createGuest("제이"),
    createGuest("소다"),
    createGuest("마루"),
    createGuest("도윤"),
    createGuest("나나"),
  ];
  state.rounds = [
    {
      id: `round-${roundSequence++}`,
      cardOrder: 1,
      roundValue: 3,
      scheduleTitle: "3차 저녁 모임",
      totalAmount: 198000,
      attendees: [
        { guestId: state.guests[0].id, isNew: false },
        { guestId: state.guests[1].id, isNew: true },
        { guestId: state.guests[2].id, isNew: false },
        { guestId: state.guests[3].id, isNew: false },
      ],
    },
    {
      id: `round-${roundSequence++}`,
      cardOrder: 2,
      roundValue: 3,
      scheduleTitle: "3차 늦은 합류 테이블",
      totalAmount: 264000,
      attendees: [
        { guestId: state.guests[0].id, isNew: false },
        { guestId: state.guests[1].id, isNew: false },
        { guestId: state.guests[2].id, isNew: false },
        { guestId: state.guests[3].id, isNew: true },
        { guestId: state.guests[4].id, isNew: false },
        { guestId: state.guests[5].id, isNew: false },
      ],
    },
  ];
  syncRoundOrders();
  setFeedback("샘플 데이터를 불러왔습니다.");
  render();
}

function resetState() {
  state.hostName = "";
  state.accountType = "";
  state.accountNumber = "";
  state.guests = [];
  state.rounds = [createRound()];
  syncRoundOrders();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures in the prototype.
  }
  setFeedback("서비스 화면을 초기 상태로 되돌렸습니다.");
  render();
}

function syncInputsFromState() {
  dom.hostNameInput.value = state.hostName;
  dom.accountTypeSelect.value = state.accountType;
  dom.accountNumberInput.value = state.accountNumber;
  dom.guestForm.reset();
}

function render() {
  syncInputsFromState();
  renderGuestList();
  renderRoundEditors();
  renderResultsOnly();
}

function renderResultsOnly() {
  const calculations = calculateSettlement();
  renderValidation(calculations.validationMessages);
  renderSummaryCards(calculations.summary);
  renderRoundResults(calculations.rounds);
  renderTotalResults(calculations.participants, calculations.summary);
  updateFieldAccessibility(calculations.validationMessages);
  saveState();
}

function renderGuestList() {
  const hostName = state.hostName.trim() || "벙주 미입력";
  const hostCard = `
    <div class="guest-item">
      <div>
        <div class="guest-item__meta">
          <span class="guest-item__name">${escapeHtml(hostName)}</span>
          <span class="badge badge--host">벙주</span>
        </div>
        <div class="text-muted">모든 일정 카드에 자동 포함됩니다.</div>
      </div>
    </div>
  `;

  if (!state.guests.length) {
    dom.guestList.innerHTML = `
      ${hostCard}
      <div class="empty-state">아직 추가된 일반 참석자가 없습니다.</div>
    `;
    return;
  }

  const guestsMarkup = state.guests
    .map(
      (guest) => `
        <div class="guest-item">
          <div>
            <div class="guest-item__meta">
              <span class="guest-item__name">${escapeHtml(guest.name)}</span>
            </div>
            <div class="text-muted">일정 카드별로 참석 여부와 신입 여부를 따로 체크합니다.</div>
          </div>
          <button class="button button--danger" type="button" data-remove-guest="${guest.id}">
            삭제
          </button>
        </div>
      `
    )
    .join("");

  dom.guestList.innerHTML = `${hostCard}${guestsMarkup}`;
}

function renderRoundEditors() {
  dom.roundEditors.innerHTML = state.rounds
    .map((round) => {
      const participantCount = 1 + round.attendees.length;
      const hostDiscount = getHostDiscount(participantCount, round.roundValue);
      const roundOptions = ROUND_OPTIONS.map(
        (option) => `
          <option value="${option}" ${option === round.roundValue ? "selected" : ""}>${option}차</option>
        `
      ).join("");

      const guestOptions = state.guests.length
        ? state.guests
            .map((guest) => {
              const attendee = round.attendees.find((item) => item.guestId === guest.id);
              const isAttending = Boolean(attendee);
              return `
                <div class="attendee-row">
                  <label class="attendee-pill">
                    <input type="checkbox" data-attendee-id="${guest.id}" ${isAttending ? "checked" : ""} />
                    <span>${escapeHtml(guest.name)}</span>
                  </label>

                  <label class="checkbox checkbox--inline ${isAttending ? "" : "checkbox--disabled"}">
                    <input
                      type="checkbox"
                      data-attendee-new-id="${guest.id}"
                      ${attendee?.isNew ? "checked" : ""}
                      ${isAttending ? "" : "disabled"}
                    />
                    <span>신입</span>
                  </label>
                </div>
              `;
            })
            .join("")
        : '<div class="empty-state">일반 참석자를 먼저 추가해 주세요.</div>';

      return `
        <article class="round-editor" data-round-id="${round.id}">
          <div class="round-editor__header">
            <div>
              <h3>일정 카드 ${round.cardOrder}</h3>
              <p class="round-editor__sub">
                선택 차수 ${round.roundValue}차, 현재 참석 ${participantCount}명, 적용 할인 ${formatWon(hostDiscount)}
              </p>
            </div>
            <button class="button button--danger" type="button" data-remove-round="${round.id}">
              카드 삭제
            </button>
          </div>

          <label class="field">
            <span class="field__label">일정 제목</span>
            <input
              type="text"
              value="${escapeHtml(round.scheduleTitle)}"
              data-field="scheduleTitle"
              placeholder="예: 1차 일정제목"
            />
          </label>

          <div class="field-grid">
            <label class="field">
              <span class="field__label">차수 선택</span>
              <select data-field="roundValue">${roundOptions}</select>
            </label>

            <label class="field">
              <span class="field__label">결제 총금액</span>
              <input
                type="number"
                min="0"
                step="1000"
                value="${round.totalAmount}"
                data-field="totalAmount"
                placeholder="예: 198000"
              />
            </label>
          </div>

          <div class="attendee-grid">
            <label class="attendee-pill attendee-pill--fixed">
              <input type="checkbox" checked disabled />
              <span>${escapeHtml(state.hostName.trim() || "벙주")}</span>
              <span class="badge badge--host">자동 포함</span>
            </label>
            ${guestOptions}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderValidation(messages) {
  if (!messages.length) {
    dom.validationBox.innerHTML = `
      <div class="validation-card validation-card--ok">
        입력값이 유효합니다. 현재 상태는 브라우저에 자동 저장됩니다.
      </div>
    `;
    return;
  }

  dom.validationBox.innerHTML = messages
    .map(
      (message) => `
        <div class="validation-card">${escapeHtml(message)}</div>
      `
    )
    .join("");
}

function renderSummaryCards(summary) {
  const cards = [
    {
      label: "총 결제 합계",
      value: formatWon(summary.grandTotalPayment),
      note: `${summary.cardCount}개 일정 카드 기준`,
    },
    {
      label: "벙주 본인 부담",
      value: formatWon(summary.hostBurden),
      note: escapeHtml(summary.hostName),
    },
    {
      label: "지금 받을 금액",
      value: formatWon(summary.collectNow),
      note: "입금 필요/추가 입금 합계",
    },
    {
      label: "지금 환불할 금액",
      value: formatWon(summary.refundNow),
      note: "신입 선입금 초과분 환불",
    },
    {
      label: "신입 선입금 총액",
      value: formatWon(summary.totalAdvance),
      note: `${summary.newAppliedCount}명 1회 적용`,
    },
  ];

  dom.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <div class="summary-card">
          <span class="summary-card__label">${card.label}</span>
          <span class="summary-card__value">${card.value}</span>
          <span class="summary-card__note">${card.note}</span>
        </div>
      `
    )
    .join("");
}

function renderRoundResults(rounds) {
  if (!rounds.length) {
    dom.roundResults.innerHTML = '<div class="empty-state">아직 일정 카드 데이터가 없습니다.</div>';
    return;
  }

  dom.roundResults.innerHTML = rounds
    .map((round) => {
      const rows = round.assignments
        .map(
          (assignment) => `
            <tr>
              <td class="text-strong" data-label="이름">${escapeHtml(assignment.name)}</td>
              <td data-label="구분">
                ${assignment.isHost ? '<span class="badge badge--host">벙주</span>' : ""}
                ${assignment.isNew ? '<span class="badge badge--new">신입</span>' : ""}
                ${!assignment.isHost && !assignment.isNew ? '<span class="text-muted">일반</span>' : ""}
              </td>
              <td data-label="부담 금액">${formatWon(assignment.share)}</td>
            </tr>
          `
        )
        .join("");

      return `
        <article class="round-result">
          <div class="round-result__top">
            <div>
              <h3>${escapeHtml(round.displayTitle)}</h3>
              <p class="text-muted">
                ${round.roundLabel} · 일정 카드 ${round.cardOrder} · 결제 총금액 ${formatWon(round.totalAmount)}
              </p>
            </div>
            <div class="round-result__stats">
              <span class="mini-stat">참석 ${round.participantCount}명</span>
              <span class="mini-stat">적용 할인 ${formatWon(round.hostDiscount)}</span>
              <span class="mini-stat">잔여 분배 ${round.distributedRemainder}원</span>
            </div>
          </div>

          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>구분</th>
                  <th>부담 금액</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTotalResults(participants, summary) {
  if (!participants.length) {
    dom.totalResults.innerHTML = '<div class="empty-state">총합 정산 대상이 아직 없습니다.</div>';
    return;
  }

  const rows = participants
    .map((participant) => {
      const badges = [
        participant.isHost ? '<span class="badge badge--host">벙주</span>' : "",
        participant.wasNew ? '<span class="badge badge--new">신입 1회 적용</span>' : "",
      ]
        .filter(Boolean)
        .join(" ");

      const statusClass =
        participant.statusTone === "success"
          ? "badge--success"
          : participant.statusTone === "warning"
            ? "badge--warning"
            : participant.statusTone === "danger"
              ? "badge--danger"
              : "badge--info";

      return `
        <tr>
          <td data-label="이름">
            <div class="text-strong">${escapeHtml(participant.name)}</div>
            <div class="text-muted">${badges || "일반 참석자"}</div>
          </td>
          <td data-label="참석 일정">${participant.joinedRounds.join(", ") || "-"}</td>
          <td data-label="누적 부담액">${formatWon(participant.totalAssigned)}</td>
          <td data-label="선입금">${formatWon(participant.advanceApplied)}</td>
          <td data-label="현재 상태"><span class="badge ${statusClass}">${participant.statusLabel}</span></td>
          <td class="text-strong" data-label="현재 정산액">${formatWon(participant.currentAmount)}</td>
        </tr>
      `;
    })
    .join("");

  dom.totalResults.innerHTML = `
    <div class="hint">
      ${escapeHtml(summary.hostName)} 기준 입금 계좌는
      <strong>${escapeHtml(summary.accountDisplay)}</strong> 입니다.
    </div>
    <div class="hint">
      지금 받을 돈은 <strong>${formatWon(summary.collectNow)}</strong>, 환불할 돈은
      <strong>${formatWon(summary.refundNow)}</strong>입니다.
    </div>
    <table>
      <thead>
        <tr>
          <th>이름</th>
          <th>참석 일정</th>
          <th>누적 부담액</th>
          <th>선입금</th>
          <th>현재 상태</th>
          <th>현재 정산액</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function calculateSettlement() {
  const validationMessages = validateState();
  const hostName = state.hostName.trim() || "벙주";
  const rounds = state.rounds.map((round) => calculateRound(round));
  const participantMap = new Map();

  participantMap.set("host", {
    id: "host",
    name: hostName,
    isHost: true,
    wasNew: false,
    totalAssigned: 0,
    joinedRounds: [],
  });

  state.guests.forEach((guest) => {
    participantMap.set(guest.id, {
      id: guest.id,
      name: guest.name,
      isHost: false,
      wasNew: false,
      totalAssigned: 0,
      joinedRounds: [],
    });
  });

  rounds.forEach((round) => {
    round.assignments.forEach((assignment) => {
      const participant = participantMap.get(assignment.id);
      if (!participant) {
        return;
      }

      participant.totalAssigned += assignment.share;
      participant.joinedRounds.push(round.displayTitle);
      if (assignment.isNew) {
        participant.wasNew = true;
      }
    });
  });

  const participants = Array.from(participantMap.values()).map((participant) => {
    if (participant.isHost) {
      return {
        ...participant,
        advanceApplied: 0,
        currentAmount: participant.totalAssigned,
        statusLabel: "본인 부담",
        statusTone: "info",
      };
    }

    if (!participant.joinedRounds.length) {
      return {
        ...participant,
        advanceApplied: 0,
        currentAmount: 0,
        statusLabel: "미참석",
        statusTone: "info",
      };
    }

    if (!participant.wasNew) {
      return {
        ...participant,
        advanceApplied: 0,
        currentAmount: participant.totalAssigned,
        statusLabel: "입금 필요",
        statusTone: participant.totalAssigned > 0 ? "warning" : "info",
      };
    }

    const difference = participant.totalAssigned - NEW_MEMBER_ADVANCE;
    if (difference > 0) {
      return {
        ...participant,
        advanceApplied: NEW_MEMBER_ADVANCE,
        currentAmount: difference,
        statusLabel: "추가 입금",
        statusTone: "warning",
      };
    }

    if (difference < 0) {
      return {
        ...participant,
        advanceApplied: NEW_MEMBER_ADVANCE,
        currentAmount: Math.abs(difference),
        statusLabel: "환불 예정",
        statusTone: "success",
      };
    }

    return {
      ...participant,
      advanceApplied: NEW_MEMBER_ADVANCE,
      currentAmount: 0,
      statusLabel: "정산 완료",
      statusTone: "success",
    };
  });

  const host = participants.find((participant) => participant.isHost);
  const collectNow = participants.reduce((sum, participant) => {
    if (participant.statusLabel === "입금 필요" || participant.statusLabel === "추가 입금") {
      return sum + participant.currentAmount;
    }
    return sum;
  }, 0);
  const refundNow = participants.reduce((sum, participant) => {
    return participant.statusLabel === "환불 예정" ? sum + participant.currentAmount : sum;
  }, 0);

  return {
    validationMessages,
    rounds,
    participants,
    summary: {
      hostName,
      accountDisplay: buildAccountDisplay(),
      cardCount: rounds.length,
      grandTotalPayment: rounds.reduce((sum, round) => sum + round.totalAmount, 0),
      hostBurden: host ? host.totalAssigned : 0,
      collectNow,
      refundNow,
      totalAdvance: participants.reduce((sum, participant) => sum + participant.advanceApplied, 0),
      newAppliedCount: participants.filter((participant) => participant.advanceApplied > 0).length,
    },
  };
}

function calculateRound(round) {
  const hostName = state.hostName.trim() || "벙주";
  const guestAttendees = round.attendees
    .map((attendee) => {
      const guest = state.guests.find((item) => item.id === attendee.guestId);
      if (!guest) {
        return null;
      }

      return {
        id: guest.id,
        name: guest.name,
        isHost: false,
        isNew: attendee.isNew,
      };
    })
    .filter(Boolean);

  const participantCount = 1 + guestAttendees.length;
  const hostDiscount = getHostDiscount(participantCount, round.roundValue);
  const nonHostCount = Math.max(participantCount - 1, 0);
  const rawHostAmount = Math.max(round.totalAmount / Math.max(participantCount, 1) - hostDiscount, 0);
  const rawNonHostAmount =
    nonHostCount > 0 ? (round.totalAmount - rawHostAmount) / nonHostCount : round.totalAmount;

  let hostShare = Math.floor(rawHostAmount);
  const guestShares = guestAttendees.map((guest) => ({
    ...guest,
    share: Math.floor(rawNonHostAmount),
  }));

  const baseAssigned = hostShare + guestShares.reduce((sum, guest) => sum + guest.share, 0);
  let remainder = Math.max(round.totalAmount - baseAssigned, 0);
  const distributedRemainder = remainder;

  if (guestShares.length) {
    let index = 0;
    while (remainder > 0) {
      guestShares[index % guestShares.length].share += 1;
      remainder -= 1;
      index += 1;
    }
  } else {
    hostShare += remainder;
  }

  const assignments = [
    {
      id: "host",
      name: hostName,
      isHost: true,
      isNew: false,
      share: hostShare,
    },
    ...guestShares,
  ];

  return {
    id: round.id,
    cardOrder: round.cardOrder,
    roundValue: round.roundValue,
    roundLabel: `${round.roundValue}차`,
    displayTitle: buildRoundDisplayTitle(round),
    totalAmount: round.totalAmount,
    participantCount,
    hostDiscount,
    distributedRemainder,
    assignedTotal: assignments.reduce((sum, assignment) => sum + assignment.share, 0),
    assignments,
  };
}

function validateState() {
  const messages = [];

  if (!state.hostName.trim()) {
    messages.push("벙주 닉네임을 입력하면 결과가 더 명확하게 표시됩니다.");
  }

  const names = new Set();
  state.guests.forEach((guest) => {
    if (!guest.name.trim()) {
      messages.push("빈 닉네임 참석자가 있습니다.");
      return;
    }

    if (names.has(guest.name)) {
      messages.push("같은 닉네임의 참석자가 중복되어 있습니다.");
    }
    names.add(guest.name);
  });

  if (state.hostName.trim() && names.has(state.hostName.trim())) {
    messages.push("벙주 닉네임과 동일한 참석자 닉네임이 있습니다.");
  }

  if (state.accountType && !state.accountNumber.trim()) {
    messages.push("계좌 유형/기관을 선택했다면 계좌번호도 입력해 주세요.");
  }

  if (!state.accountType && state.accountNumber.trim()) {
    messages.push("계좌번호를 입력했다면 계좌 유형/기관도 선택해 주세요.");
  }

  state.rounds.forEach((round) => {
    if (!round.scheduleTitle.trim()) {
      messages.push(`${round.roundValue}차(일정 카드 ${round.cardOrder}) 일정 제목을 입력해 주세요.`);
    }

    if (round.totalAmount <= 0) {
      messages.push(`${round.roundValue}차(일정 카드 ${round.cardOrder}) 결제 총금액을 입력해 주세요.`);
    }
  });

  return Array.from(new Set(messages));
}

function getHostDiscount(participantCount, roundValue) {
  if (roundValue < 3) {
    return participantCount >= 6 ? 10000 : 0;
  }

  return participantCount >= 8 ? 20000 : 0;
}

function buildRoundSummaryText(calculations) {
  const lines = [
    "차수별 정산 요약",
    `벙주: ${calculations.summary.hostName}`,
    `계좌: ${calculations.summary.accountDisplay}`,
    "",
  ];

  calculations.rounds.forEach((round) => {
    lines.push(
      `${round.displayTitle} | 총액 ${formatWon(round.totalAmount)} | 참석 ${round.participantCount}명 | 적용 할인 ${formatWon(round.hostDiscount)}`
    );
    round.assignments.forEach((assignment) => {
      const tag = assignment.isHost ? "벙주" : assignment.isNew ? "신입" : "일반";
      lines.push(`- ${assignment.name} (${tag}) : ${formatWon(assignment.share)}`);
    });
    lines.push("");
  });

  return lines.join("\n").trim();
}

function buildTotalSummaryText(calculations) {
  const lines = [
    "최종 총합 정산",
    `벙주: ${calculations.summary.hostName}`,
    `계좌: ${calculations.summary.accountDisplay}`,
    `총 결제 합계: ${formatWon(calculations.summary.grandTotalPayment)}`,
    `벙주 본인 부담: ${formatWon(calculations.summary.hostBurden)}`,
    `지금 받을 금액: ${formatWon(calculations.summary.collectNow)}`,
    `지금 환불할 금액: ${formatWon(calculations.summary.refundNow)}`,
    `신입 선입금 총액: ${formatWon(calculations.summary.totalAdvance)}`,
    "",
    "[참석자별 최종 상태]",
  ];

  calculations.participants.forEach((participant) => {
    const joined = participant.joinedRounds.join(", ") || "-";
    lines.push(
      `- ${participant.name} | ${participant.statusLabel} ${formatWon(participant.currentAmount)} | 누적 부담 ${formatWon(participant.totalAssigned)} | 선입금 ${formatWon(participant.advanceApplied)} | 참석 ${joined}`
    );
  });

  return lines.join("\n");
}

async function copyToClipboard(text, message) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }
    setFeedback(message);
  } catch (error) {
    try {
      fallbackCopyText(text);
      setFeedback(message);
    } catch (fallbackError) {
      setFeedback("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function setFeedback(message) {
  dom.copyFeedback.textContent = message;
}

function updateFieldAccessibility(validationMessages) {
  const hostInvalid =
    !state.hostName.trim() || state.guests.some((guest) => guest.name === state.hostName.trim());
  dom.hostNameInput.setAttribute("aria-invalid", String(hostInvalid));
  dom.accountTypeSelect.setAttribute(
    "aria-invalid",
    String(validationMessages.some((message) => message.includes("계좌 유형/기관")))
  );
  dom.accountNumberInput.setAttribute(
    "aria-invalid",
    String(validationMessages.some((message) => message.includes("계좌번호")))
  );

  document.querySelectorAll("[data-field='totalAmount']").forEach((input) => {
    input.setAttribute("aria-invalid", String(toInteger(input.value) <= 0));
  });

  document.querySelectorAll("[data-field='scheduleTitle']").forEach((input) => {
    input.setAttribute("aria-invalid", String(!input.value.trim()));
  });
}

function buildAccountDisplay() {
  const accountType = state.accountType.trim();
  const accountNumber = state.accountNumber.trim();

  if (accountType && accountNumber) {
    return `${accountType} ${accountNumber}`;
  }

  if (accountType) {
    return accountType;
  }

  if (accountNumber) {
    return accountNumber;
  }

  return "계좌 미입력";
}

function buildRoundDisplayTitle(round) {
  const title = round.scheduleTitle.trim();
  if (title) {
    return title;
  }

  return `${round.roundValue}차 일정 카드 ${round.cardOrder}`;
}

function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function toInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
