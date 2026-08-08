const MODULE = 'eldin_mobile_ui';
const MOBILE_QUERY = '(max-width: 1000px)';
let initialized = false;
let eventsBound = false;
let uiObserver = null;
let textareaObserver = null;
let geometryRaf = null;
let activePanelStage = null;
let themeColorObserver = null;
let generationControlsObserver = null;
let lastChatScrollTop = 0;
let longPressTimer = null;
let longPressStart = null;
let longPressMessage = null;

const log = (...args) => console.log(`[${MODULE}]`, ...args);

function isMobileLayout() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

function getContext() {
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch (error) {
        console.warn(`[${MODULE}] Could not read SillyTavern context`, error);
        return null;
    }
}

function cleanChatId(value) {
    if (!value) return '';
    return String(value)
        .replace(/\.jsonl$/i, '')
        .replace(/\.json$/i, '');
}

function visibleElement(elements) {
    return Array.from(elements).find((el) => {
        const style = getComputedStyle(el);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !el.classList.contains('displayNone');
    }) ?? Array.from(elements).at(-1) ?? null;
}

function makeButton(id, label, iconClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'em-ui-button';
    button.setAttribute('aria-label', label);
    button.title = label;

    if (iconClass) {
        const icon = document.createElement('i');
        icon.className = iconClass;
        button.appendChild(icon);
    }

    return button;
}

function findCurrentGroup(ctx) {
    if (!ctx?.groupId || !Array.isArray(ctx.groups)) return null;
    return ctx.groups.find(group => String(group.id) === String(ctx.groupId)) ?? null;
}

function findCurrentCharacter(ctx) {
    if (ctx?.characterId === undefined || ctx?.characterId === null || !Array.isArray(ctx?.characters)) {
        return null;
    }

    const numericId = Number(ctx.characterId);
    return ctx.characters[numericId] ??
        ctx.characters.find((character, index) =>
            String(character?.id ?? index) === String(ctx.characterId)
        ) ??
        null;
}

function getThumbnail(ctx, avatar) {
    if (!avatar) return '';

    try {
        if (typeof ctx?.getThumbnailUrl === 'function') {
            return ctx.getThumbnailUrl('avatar', avatar);
        }
    } catch (error) {
        console.debug(`[${MODULE}] getThumbnailUrl fallback`, error);
    }

    if (/^(https?:|data:|blob:|\/)/i.test(String(avatar))) {
        return String(avatar);
    }

    return `/thumbnail?type=avatar&file=${encodeURIComponent(String(avatar))}`;
}

function getHeaderData() {
    const ctx = getContext();
    if (!ctx) {
        return { title: 'SillyTavern', subtitle: '', avatar: '' };
    }

    const group = findCurrentGroup(ctx);
    const character = findCurrentCharacter(ctx);

    let title = ctx.name2 || 'SillyTavern';
    let avatar = '';

    if (group) {
        title = group.name || title;

        if (group.avatar_url) {
            avatar = String(group.avatar_url);
        } else if (Array.isArray(group.members) && group.members.length) {
            const memberAvatar = group.members
                .map(member => typeof member === 'string' ? member : member?.avatar)
                .find(Boolean);
            avatar = getThumbnail(ctx, memberAvatar);
        }
    } else if (character) {
        title = character.name || title;
        avatar = getThumbnail(ctx, character.avatar);
    }

    let chatId = '';
    try {
        chatId = cleanChatId(
            ctx.chatId ||
            ctx.getCurrentChatId?.() ||
            group?.chat_id ||
            character?.chat
        );
    } catch {
        chatId = cleanChatId(group?.chat_id || character?.chat);
    }

    // If ST's chat ID already contains the chat title, don't duplicate it.
    const subtitle = chatId
        ? (chatId.toLowerCase().startsWith(title.toLowerCase()) ? chatId : `${title} · ${chatId}`)
        : title;

    return { title, subtitle, avatar };
}

function renderHeaderAvatar(src, title) {
    const holder = document.querySelector('#em-header-avatar');
    if (!holder) return;

    holder.innerHTML = '';

    if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = title || 'Chat';
        holder.appendChild(img);
    } else {
        const fallback = document.createElement('i');
        fallback.className = 'fa-solid fa-comments';
        holder.appendChild(fallback);
    }
}

function updateHeader() {
    const header = document.querySelector('#em-mobile-header');
    if (!header) return;

    const { title, subtitle, avatar } = getHeaderData();
    const titleEl = header.querySelector('#em-header-title');
    const subtitleEl = header.querySelector('#em-header-subtitle');

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
        subtitleEl.textContent = subtitle;
        subtitleEl.title = subtitle;
    }

    renderHeaderAvatar(avatar, title);
    scheduleGeometryUpdate();
}

function updateGeometry() {
    geometryRaf = null;
    const topBar = document.querySelector('#top-bar');
    if (!topBar) return;

    const rect = topBar.getBoundingClientRect();
    document.documentElement.style.setProperty('--em-topbar-top', `${Math.max(0, rect.top)}px`);
    document.documentElement.style.setProperty('--em-topbar-bottom', `${Math.max(0, rect.bottom)}px`);
    document.documentElement.style.setProperty('--em-topbar-height', `${Math.max(0, rect.height)}px`);
}

function scheduleGeometryUpdate() {
    if (geometryRaf) cancelAnimationFrame(geometryRaf);
    geometryRaf = requestAnimationFrame(updateGeometry);
}


function revealHeader() {
    document.body.classList.remove('em-header-hidden');
    scheduleGeometryUpdate();
}

function hideHeader() {
    if (
        document.body.classList.contains('em-top-menu-open') ||
        document.body.classList.contains('em-tools-open') ||
        document.body.classList.contains('em-panel-open')
    ) {
        return;
    }

    document.body.classList.add('em-header-hidden');
    scheduleGeometryUpdate();
}

function getDrawerLabel(drawer, content) {
    const icon = drawer?.querySelector(':scope > .drawer-toggle .drawer-icon');
    const iconTitle = icon?.getAttribute('title')?.trim();
    if (iconTitle) return iconTitle;

    const heading = content?.querySelector('h1, h2, h3, .panel-title, .drawer-title');
    const headingText = heading?.textContent?.trim();
    if (headingText) return headingText;

    return 'SillyTavern';
}

function buildPanelStage() {
    if (document.querySelector('#em-panel-stage')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'em-panel-backdrop';

    const stage = document.createElement('section');
    stage.id = 'em-panel-stage';
    stage.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.id = 'em-panel-stage-header';

    const title = document.createElement('div');
    title.id = 'em-panel-stage-title';
    title.textContent = 'SillyTavern';

    const close = makeButton('em-panel-stage-close', 'Close panel');
    close.classList.add('em-panel-stage-close');
    close.textContent = '×';

    const body = document.createElement('div');
    body.id = 'em-panel-stage-body';

    header.append(title, close);
    stage.append(header, body);
    document.body.append(backdrop, stage);

    close.addEventListener('click', () => closePanelStage());
    backdrop.addEventListener('click', () => closePanelStage());
}

function collapseNativeDrawer(drawer, content) {
    if (!drawer || !content) return;

    content.classList.remove('openDrawer');
    content.classList.add('closedDrawer');
    content.style.removeProperty('display');
    content.style.removeProperty('height');

    const icon = drawer.querySelector(':scope > .drawer-toggle .drawer-icon');
    if (icon) {
        icon.classList.remove('openIcon');
        icon.classList.add('closedIcon');
    }
}

function stageNativePanel(drawer, content) {
    buildPanelStage();

    if (!drawer || !content) return;

    if (activePanelStage?.content === content) {
        revealHeader();
        return;
    }

    if (activePanelStage) {
        closePanelStage({ collapse: true });
    }

    const stage = document.querySelector('#em-panel-stage');
    const stageBody = document.querySelector('#em-panel-stage-body');
    const stageTitle = document.querySelector('#em-panel-stage-title');
    if (!stage || !stageBody || !stageTitle) return;

    const placeholder = document.createComment('eldin-mobile-ui-panel-placeholder');
    content.parentNode?.insertBefore(placeholder, content);

    content.classList.remove('closedDrawer');
    content.classList.add('openDrawer', 'em-staged-panel');

    stageBody.replaceChildren(content);
    stageTitle.textContent = getDrawerLabel(drawer, content);

    activePanelStage = {
        drawer,
        content,
        placeholder,
    };

    document.body.classList.add('em-panel-open');
    stage.setAttribute('aria-hidden', 'false');

    // Keep the compact top icon tray open if the user opened the panel from it.
    // This makes switching between API / World Info / Extensions / etc. instant.
    closeToolTray();
    revealHeader();

    requestAnimationFrame(() => {
        content.scrollTop = 0;
        scheduleGeometryUpdate();
    });
}

function closePanelStage({ collapse = true } = {}) {
    if (!activePanelStage) {
        document.body.classList.remove('em-panel-open');
        document.querySelector('#em-panel-stage')?.setAttribute('aria-hidden', 'true');
        return;
    }

    const { drawer, content, placeholder } = activePanelStage;

    content.classList.remove('em-staged-panel');

    if (placeholder?.parentNode) {
        placeholder.parentNode.insertBefore(content, placeholder);
        placeholder.remove();
    } else if (drawer) {
        drawer.appendChild(content);
    }

    if (collapse) {
        collapseNativeDrawer(drawer, content);
    }

    activePanelStage = null;
    document.body.classList.remove('em-panel-open');
    document.querySelector('#em-panel-stage')?.setAttribute('aria-hidden', 'true');
    document.querySelector('#em-panel-stage-body')?.replaceChildren();

    scheduleGeometryUpdate();
}

function stageDrawerAfterNativeToggle(drawer, contentRef = null) {
    const content = contentRef || drawer?.querySelector('.drawer-content');
    if (!drawer || !content) return;

    // Let SillyTavern run its own click/open handler first (some panels update
    // their contents when opened), then move the exact live panel into our
    // full-size mobile stage. We do not depend on openDrawer/display state:
    // the user's tap itself is the intent to open the panel.
    window.setTimeout(() => {
        stageNativePanel(drawer, content);
    }, 70);
}

function bindTopDrawerStaging() {
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;

        const toggle = event.target.closest('#top-settings-holder .drawer-toggle');
        if (!toggle) return;

        const drawer = toggle.closest('.drawer');
        if (!drawer) return;

        // Keep a direct reference before SillyTavern potentially reparents or
        // animates the drawer content.
        const content = drawer.querySelector('.drawer-content');
        if (!content) return;

        stageDrawerAfterNativeToggle(drawer, content);
    }, false);
}

function openCurrentChatDetails() {
    const holder = document.querySelector('#rightNavHolder');
    const toggle = holder?.querySelector(':scope > .drawer-toggle, .drawer-toggle');
    const panel = document.querySelector('#right-nav-panel');

    if (!holder || !panel) return;

    revealHeader();
    closeToolTray();
    closeTopMenu();

    const finishOpen = () => {
        // Group chat: select the group's own controls page.
        document.querySelector('#rm_button_selected_ch')?.click();
        stageNativePanel(holder, panel);
    };

    if (activePanelStage?.content === panel) {
        finishOpen();
        return;
    }

    // Allow SillyTavern to perform any native initialization first.
    if (toggle) {
        toggle.click();
    }

    window.setTimeout(finishOpen, 90);
}

function openMessageCharacter(message) {
    if (!(message instanceof Element)) return;

    const ctx = getContext();
    const group = findCurrentGroup(ctx);

    if (!group) {
        openCurrentChatDetails();
        return;
    }

    const characterName = message.getAttribute('ch_name')?.trim();
    if (!characterName || !Array.isArray(ctx?.characters)) {
        openCurrentChatDetails();
        return;
    }

    const characterId = ctx.characters.findIndex(character =>
        String(character?.name ?? '').trim() === characterName
    );

    openCurrentChatDetails();

    if (characterId < 0) return;

    const tryOpen = () => {
        const viewButton =
            document.querySelector(
                `#right-nav-panel .group_member[data-chid="${characterId}"] [data-action="view"]`
            ) ||
            document.querySelector(
                `#right-nav-panel .group_member[data-chid="${characterId}"] .right_menu_button[title*="View"]`
            );

        if (viewButton) {
            viewButton.click();
            const stageTitle = document.querySelector('#em-panel-stage-title');
            if (stageTitle) stageTitle.textContent = characterName;
            return true;
        }

        return false;
    };

    if (!tryOpen()) {
        window.setTimeout(() => {
            if (!tryOpen()) {
                window.setTimeout(tryOpen, 150);
            }
        }, 80);
    }
}

function bindHeaderInteractions() {
    const headerAvatar = document.querySelector('#em-header-avatar');
    const headerText = document.querySelector('.em-header-text');

    for (const el of [headerAvatar, headerText]) {
        if (!el || el.dataset.emBound === '1') continue;
        el.dataset.emBound = '1';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');

        el.addEventListener('click', openCurrentChatDetails);
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCurrentChatDetails();
            }
        });
    }
}

function bindMessageCharacterClicks() {
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;

        const trigger = event.target.closest(
            '.mes[is_user="false"] .name_text'
        );

        if (!trigger) return;

        const message = trigger.closest('.mes');
        if (!message) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        openMessageCharacter(message);
    }, true);
}

function bindAutoHideHeader() {
    const chat = document.querySelector('#chat');
    if (!chat || chat.dataset.emAutoHideBound === '1') return;

    chat.dataset.emAutoHideBound = '1';

    let previousScrollTop = chat.scrollTop;
    let accumulatedDelta = 0;
    let touchY = null;

    const menusAreOpen = () =>
        document.body.classList.contains('em-panel-open') ||
        document.body.classList.contains('em-top-menu-open') ||
        document.body.classList.contains('em-tools-open');

    chat.addEventListener('scroll', () => {
        const current = chat.scrollTop;
        const delta = current - previousScrollTop;

        if (menusAreOpen()) {
            revealHeader();
            previousScrollTop = current;
            accumulatedDelta = 0;
            return;
        }

        // Accumulate small iOS scroll increments instead of requiring one
        // single scroll event to exceed a threshold.
        if (
            accumulatedDelta === 0 ||
            Math.sign(delta) === Math.sign(accumulatedDelta)
        ) {
            accumulatedDelta += delta;
        } else {
            accumulatedDelta = delta;
        }

        if (accumulatedDelta > 18 && current > 35) {
            hideHeader();
            accumulatedDelta = 0;
        } else if (accumulatedDelta < -14 || current < 18) {
            revealHeader();
            accumulatedDelta = 0;
        }

        previousScrollTop = current;
    }, { passive: true });

    // iOS Safari fallback: react to the actual finger direction as well.
    chat.addEventListener('touchstart', (event) => {
        touchY = event.touches?.[0]?.clientY ?? null;
    }, { passive: true });

    chat.addEventListener('touchmove', (event) => {
        if (touchY === null || menusAreOpen()) return;

        const y = event.touches?.[0]?.clientY;
        if (typeof y !== 'number') return;

        const fingerDelta = y - touchY;

        // Finger moving upward -> user is moving forward/down through chat.
        if (fingerDelta < -18 && chat.scrollTop > 25) {
            hideHeader();
            touchY = y;
        }
        // Finger moving downward -> reveal navigation.
        else if (fingerDelta > 16) {
            revealHeader();
            touchY = y;
        }
    }, { passive: true });

    chat.addEventListener('touchend', () => {
        touchY = null;
    }, { passive: true });

    chat.addEventListener('touchcancel', () => {
        touchY = null;
    }, { passive: true });
}

function getLastSwipeState() {
    const ctx = getContext();
    const message = Array.isArray(ctx?.chat) ? ctx.chat.at(-1) : null;

    if (!message || message.is_user || message.is_system) {
        return {
            ctx,
            message,
            current: 0,
            count: 0,
            canGoBack: false,
            hasExistingNext: false,
        };
    }

    const swipes = Array.isArray(message.swipes)
        ? message.swipes
        : (typeof message.mes === 'string' ? [message.mes] : []);

    const current = Number.isFinite(Number(message.swipe_id))
        ? Number(message.swipe_id)
        : 0;

    return {
        ctx,
        message,
        current,
        count: swipes.length,
        canGoBack: current > 0,
        hasExistingNext: current >= 0 && current < swipes.length - 1,
    };
}

async function goToPreviousSwipe() {
    const { ctx, canGoBack } = getLastSwipeState();
    if (!canGoBack) return;

    if (typeof ctx?.swipe?.left === 'function') {
        await ctx.swipe.left();
    } else {
        const nativeLeft = document.querySelector('.last_mes .swipe_left');
        nativeLeft?.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    }

    window.setTimeout(updateSwipeNavigationButtons, 60);
}

function buildPreviousSwipeButton() {
    if (document.querySelector('#em-prev-swipe-button')) return;

    const button = makeButton(
        'em-prev-swipe-button',
        'Previous swipe',
        'fa-solid fa-backward'
    );
    button.classList.add('em-history-swipe-button');
    button.addEventListener('click', goToPreviousSwipe);

    const ggSwipe = document.querySelector('#gg_swipe_button');
    if (ggSwipe?.parentElement) {
        ggSwipe.parentElement.insertBefore(button, ggSwipe);
        return;
    }

    document.querySelector('#em-gg-slot')?.prepend(button);
}

function bindSmartGuidedSwipeButton() {
    const ggSwipe = document.querySelector('#gg_swipe_button');
    if (!ggSwipe || ggSwipe.dataset.emSmartSwipeBound === '1') return;

    ggSwipe.dataset.emSmartSwipeBound = '1';

    // Capture phase runs before Guided Generations' own target click handler.
    // If a saved swipe already exists ahead, use SillyTavern's normal right
    // navigation and STOP the GG handler so it does not generate anything.
    // When at the final saved swipe, we allow GG's original click listener to
    // run unchanged, preserving its typed guidance injection.
    ggSwipe.addEventListener('click', async (event) => {
        const state = getLastSwipeState();

        if (!state.hasExistingNext) {
            // No saved swipe ahead: let Guided Generations generate the next
            // one using whatever the user typed in the composer.
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        if (typeof state.ctx?.swipe?.right === 'function') {
            await state.ctx.swipe.right();
        } else {
            const nativeRight = document.querySelector('.last_mes .swipe_right');
            nativeRight?.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
            }));
        }

        window.setTimeout(updateSwipeNavigationButtons, 60);
    }, true);
}

function updateSwipeNavigationButtons() {
    const state = getLastSwipeState();
    const previous = document.querySelector('#em-prev-swipe-button');
    const ggSwipe = document.querySelector('#gg_swipe_button');

    if (previous) {
        previous.disabled = !state.canGoBack;
        previous.setAttribute('aria-disabled', String(!state.canGoBack));
        previous.title = state.canGoBack
            ? `Previous swipe (${state.current}/${Math.max(1, state.count)})`
            : 'No previous swipe';
    }

    if (ggSwipe) {
        ggSwipe.classList.toggle('em-existing-next-swipe', state.hasExistingNext);
        ggSwipe.title = state.hasExistingNext
            ? `Next saved swipe (${state.current + 2}/${state.count})`
            : 'Guided Swipe — generate a new swipe';
    }
}

function ensurePreviousSwipeButton() {
    buildPreviousSwipeButton();

    const button = document.querySelector('#em-prev-swipe-button');
    const ggSwipe = document.querySelector('#gg_swipe_button');

    if (button && ggSwipe?.parentElement && button.parentElement !== ggSwipe.parentElement) {
        ggSwipe.parentElement.insertBefore(button, ggSwipe);
    } else if (button && ggSwipe?.parentElement && button.nextElementSibling !== ggSwipe) {
        ggSwipe.parentElement.insertBefore(button, ggSwipe);
    }

    bindSmartGuidedSwipeButton();
    updateSwipeNavigationButtons();
}

function cancelLongPress() {
    if (longPressTimer) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    longPressStart = null;
    longPressMessage = null;
}

function bindLongPressMessageActions() {
    document.addEventListener('pointerdown', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.pointerType === 'mouse') return;

        if (event.target.closest(
            'a, button, input, textarea, select, .mes_buttons, .mes_edit_buttons, .code-copy, .mes_reasoning_summary'
        )) {
            return;
        }

        const block = event.target.closest('.mes .mes_block');
        const message = block?.closest('.mes');
        if (!block || !message) return;

        cancelLongPress();

        longPressStart = {
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
        };
        longPressMessage = message;

        longPressTimer = window.setTimeout(() => {
            const hint = longPressMessage?.querySelector('.extraMesButtonsHint');
            if (hint) {
                hint.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                }));
                longPressMessage?.classList.add('em-actions-opened-by-hold');
            }
            cancelLongPress();
        }, 520);
    }, { passive: true });

    document.addEventListener('pointermove', (event) => {
        if (!longPressStart || event.pointerId !== longPressStart.pointerId) return;

        const distance = Math.hypot(
            event.clientX - longPressStart.x,
            event.clientY - longPressStart.y
        );

        if (distance > 12) {
            cancelLongPress();
        }
    }, { passive: true });

    document.addEventListener('pointerup', cancelLongPress, { passive: true });
    document.addEventListener('pointercancel', cancelLongPress, { passive: true });

    document.addEventListener('contextmenu', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('.mes .mes_block')) {
            event.preventDefault();
        }
    });
}


function closeTopMenu() {
    document.body.classList.remove('em-top-menu-open');
    document.querySelector('#em-top-menu-button')?.setAttribute('aria-expanded', 'false');
}

function toggleTopMenu() {
    const open = document.body.classList.toggle('em-top-menu-open');
    document.querySelector('#em-top-menu-button')?.setAttribute('aria-expanded', String(open));

    if (open) {
        closeToolTray();
        scheduleGeometryUpdate();
    }
}

function closeCurrentChat() {
    closeTopMenu();

    const button = visibleElement(document.querySelectorAll('#option_close_chat'));
    if (button) {
        button.click();
        return;
    }

    globalThis.toastr?.info?.('Open the chat menu to close this chat.');
}

function buildHeader() {
    const topBar = document.querySelector('#top-bar');
    if (!topBar || document.querySelector('#em-mobile-header')) return;

    const header = document.createElement('div');
    header.id = 'em-mobile-header';

    const avatar = document.createElement('div');
    avatar.id = 'em-header-avatar';
    avatar.className = 'em-header-avatar';

    const text = document.createElement('div');
    text.className = 'em-header-text';

    const title = document.createElement('div');
    title.id = 'em-header-title';
    title.className = 'em-header-title';

    const subtitle = document.createElement('div');
    subtitle.id = 'em-header-subtitle';
    subtitle.className = 'em-header-subtitle';

    text.append(title, subtitle);

    const actions = document.createElement('div');
    actions.className = 'em-header-actions';

    const close = makeButton('em-close-chat-button', 'Close chat');
    close.classList.add('em-header-action', 'em-close-button');
    close.textContent = '×';
    close.addEventListener('click', closeCurrentChat);

    const menu = makeButton('em-top-menu-button', 'Open SillyTavern controls');
    menu.classList.add('em-header-action', 'em-menu-button');
    menu.setAttribute('aria-expanded', 'false');
    menu.innerHTML = '<span></span><span></span><span></span>';
    menu.addEventListener('click', toggleTopMenu);

    actions.append(close, menu);
    header.append(avatar, text, actions);
    topBar.appendChild(header);

    updateHeader();
    bindHeaderInteractions();
}

function closeToolTray() {
    document.body.classList.remove('em-tools-open');
    document.querySelector('#em-tools-toggle')?.setAttribute('aria-expanded', 'false');
}

function toggleToolTray() {
    const open = document.body.classList.toggle('em-tools-open');
    document.querySelector('#em-tools-toggle')?.setAttribute('aria-expanded', String(open));

    if (open) {
        closeTopMenu();
        adoptComposerExtensions();
    }
}

function buildComposer() {
    const sendForm = document.querySelector('#send_form');
    const nonQr = document.querySelector('#nonQRFormItems');

    if (!sendForm || !nonQr) return;

    if (!document.querySelector('#em-persona-slot')) {
        const personaSlot = document.createElement('div');
        personaSlot.id = 'em-persona-slot';
        nonQr.insertBefore(personaSlot, nonQr.firstChild);
    }

    if (!document.querySelector('#em-tools-toggle')) {
        const toolsToggle = makeButton(
            'em-tools-toggle',
            'Chat tools and guided generation',
            'fa-solid fa-wand-magic-sparkles'
        );
        toolsToggle.classList.add('em-tools-toggle');
        toolsToggle.setAttribute('aria-expanded', 'false');
        toolsToggle.addEventListener('click', toggleToolTray);

        const rightForm = document.querySelector('#rightSendForm');
        if (rightForm) {
            nonQr.insertBefore(toolsToggle, rightForm);
        } else {
            nonQr.appendChild(toolsToggle);
        }
    }

    if (!document.querySelector('#em-tool-tray')) {
        const tray = document.createElement('div');
        tray.id = 'em-tool-tray';

        const toolRow = document.createElement('div');
        toolRow.id = 'em-tool-row';

        const nativeOptionsSlot = document.createElement('div');
        nativeOptionsSlot.id = 'em-native-options-slot';
        nativeOptionsSlot.className = 'em-tray-slot';

        const leftExtrasSlot = document.createElement('div');
        leftExtrasSlot.id = 'em-left-extras-slot';
        leftExtrasSlot.className = 'em-tray-slot';

        const ggSlot = document.createElement('div');
        ggSlot.id = 'em-gg-slot';
        ggSlot.className = 'em-tray-slot em-grow-slot';

        const fallbackQrSlot = document.createElement('div');
        fallbackQrSlot.id = 'em-fallback-qr-slot';
        fallbackQrSlot.className = 'em-tray-slot';

        toolRow.append(nativeOptionsSlot, leftExtrasSlot, ggSlot, fallbackQrSlot);
        tray.appendChild(toolRow);
        sendForm.appendChild(tray);
    }

    cleanTextareaLabels();
    adoptComposerExtensions();
}

function adoptQuickPersona() {
    const slot = document.querySelector('#em-persona-slot');
    const quickPersona = document.querySelector('#quickPersona');
    if (!slot || !quickPersona) return;

    if (quickPersona.parentElement !== slot) {
        slot.appendChild(quickPersona);
    }
}

function adoptNativeOptionsButton() {
    const slot = document.querySelector('#em-native-options-slot');
    const optionsButton = document.querySelector('#options_button');
    if (!slot || !optionsButton) return;

    if (optionsButton.parentElement !== slot) {
        slot.appendChild(optionsButton);
    }
}

function adoptLeftSendExtras() {
    const source = document.querySelector('#leftSendForm');
    const slot = document.querySelector('#em-left-extras-slot');
    if (!source || !slot) return;

    const extras = Array.from(source.children).filter(el =>
        el.id !== 'options_button' &&
        el.id !== 'quickPersona' &&
        !el.id?.startsWith('em-')
    );

    for (const el of extras) {
        if (el.parentElement !== slot) {
            el.classList.add('em-adopted-left-extra');
            slot.appendChild(el);
        }
    }
}



function getGuidedResponseGroupMembers() {
    const ctx = getContext();
    if (!ctx?.groupId || !Array.isArray(ctx.groups) || !Array.isArray(ctx.characters)) {
        return [];
    }

    const group = ctx.groups.find(group => String(group.id) === String(ctx.groupId));
    if (!group || !Array.isArray(group.members)) return [];

    return group.members
        .map((memberAvatar, groupIndex) => {
            const avatar = typeof memberAvatar === 'string'
                ? memberAvatar
                : memberAvatar?.avatar;

            if (!avatar) return null;

            const chid = ctx.characters.findIndex(character => character?.avatar === avatar);
            if (chid < 0) return null;

            const character = ctx.characters[chid];
            return {
                chid,
                groupIndex,
                name: character?.name || `Character ${groupIndex + 1}`,
                avatar,
            };
        })
        .filter(Boolean);
}

function closeGuidedResponsePicker(value = null) {
    const picker = document.querySelector('#em-guided-response-picker');
    if (!picker) return;

    const resolver = picker._emResolve;
    picker.remove();

    if (typeof resolver === 'function') {
        resolver(value);
    }
}

function showGuidedResponsePicker() {
    const existing = document.querySelector('#em-guided-response-picker');
    if (existing) existing.remove();

    const members = getGuidedResponseGroupMembers();
    if (!members.length) {
        globalThis.toastr?.warning?.('No group members are available for Guided Response.');
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'em-guided-response-picker';
        overlay._emResolve = resolve;

        const sheet = document.createElement('div');
        sheet.className = 'em-gr-picker-sheet';

        const header = document.createElement('div');
        header.className = 'em-gr-picker-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'em-gr-picker-title-wrap';

        const title = document.createElement('div');
        title.className = 'em-gr-picker-title';
        title.textContent = 'Who should respond?';

        const subtitle = document.createElement('div');
        subtitle.className = 'em-gr-picker-subtitle';
        subtitle.textContent = 'Choose a character for this guided response.';

        titleWrap.append(title, subtitle);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'em-gr-picker-close';
        close.innerHTML = '&times;';
        close.setAttribute('aria-label', 'Cancel');
        close.addEventListener('click', () => closeGuidedResponsePicker(null));

        header.append(titleWrap, close);

        const list = document.createElement('div');
        list.className = 'em-gr-picker-list';

        for (const member of members) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'em-gr-picker-member';

            const avatar = document.createElement('img');
            avatar.className = 'em-gr-picker-avatar';
            avatar.alt = '';
            avatar.src = `/thumbnail?type=avatar&file=${encodeURIComponent(member.avatar)}`;
            avatar.addEventListener('error', () => {
                avatar.style.visibility = 'hidden';
            });

            const name = document.createElement('span');
            name.className = 'em-gr-picker-name';
            name.textContent = member.name;

            const arrow = document.createElement('i');
            arrow.className = 'fa-solid fa-chevron-right em-gr-picker-arrow';

            row.append(avatar, name, arrow);
            row.addEventListener('click', () => closeGuidedResponsePicker(member));
            list.appendChild(row);
        }

        sheet.append(header, list);
        overlay.appendChild(sheet);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeGuidedResponsePicker(null);
            }
        });

        document.body.appendChild(overlay);

        /*
           iPhone Safari can center fixed overlays against a larger layout
           viewport than the actually visible area. Anchor the selector above
           the visible Eldin tool tray instead.
        */
        const tray = document.querySelector('#em-tool-tray');
        const trayRect = tray?.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;

        if (trayRect && Number.isFinite(trayRect.top)) {
            const bottomGap = Math.max(170, viewportHeight - trayRect.top + 12);
            sheet.style.setProperty('--em-gr-bottom-gap', `${bottomGap}px`);
        } else {
            sheet.style.setProperty('--em-gr-bottom-gap', '190px');
        }
    });
}

async function runGuidedResponseReliably() {
    const guidedResponse = globalThis.GuidedGenerations?.guidedResponse;

    if (typeof guidedResponse !== 'function') {
        console.error(`[${MODULE}] Guided Generations guidedResponse() is not available.`);
        globalThis.toastr?.error?.('Guided Response is not ready yet.');
        return;
    }

    const ctx = getContext();

    // Single-character chats can use GG directly.
    if (!ctx?.groupId) {
        closeToolTray();
        await guidedResponse();
        return;
    }

    /*
       For group chats we select the character ourselves, then temporarily
       publish the exact cross-extension picker API that current Guided
       Generations checks before falling back to its own selector.

       GG still performs ALL actual Guided Response work:
       prompt/settings, typed guidance, injection, /trigger and generation.
       We only make the character choice reliable after moving its toolbar.
    */
    const selected = await showGuidedResponsePicker();
    if (!selected) return;

    // The user has chosen the responder. Collapse the Wand tray as generation
    // starts, matching the rest of the mobile generation UI.
    closeToolTray();

    const hadOwnSelector = Object.prototype.hasOwnProperty.call(
        globalThis,
        'STGroupResponderSelector',
    );
    const previousSelector = globalThis.STGroupResponderSelector;

    try {
        globalThis.STGroupResponderSelector = {
            pickCharacter: async () => ({
                chid: selected.chid,
                name: selected.name,
            }),
        };

        await guidedResponse();
    } finally {
        if (hadOwnSelector) {
            globalThis.STGroupResponderSelector = previousSelector;
        } else {
            try {
                delete globalThis.STGroupResponderSelector;
            } catch {
                globalThis.STGroupResponderSelector = previousSelector;
            }
        }
    }
}


function patchGuidedResponseButton() {
    const currentButton = document.querySelector('#gg_response_button');
    if (!currentButton) return;

    const applyVisualState = (button) => {
        button.classList.remove('fa-dog');
        button.classList.add('fa-comment-dots');
        button.title = 'Guided Response';
        button.setAttribute('aria-label', 'Guided Response');
    };

    if (currentButton.dataset.emGuidedResponseOwned === 'true') {
        applyVisualState(currentButton);
        return;
    }

    /*
      Guided Generations still has its own click handler on this button.
      After we relocate the toolbar, that original popup can render off-screen.
      Replacing the node with a clone removes the old listener completely, so
      only Eldin Mobile UI handles Guided Response on mobile.
    */
    const replacementButton = currentButton.cloneNode(true);
    replacementButton.dataset.emGuidedResponseOwned = 'true';
    replacementButton.dataset.emGuidedResponsePatched = 'true';
    applyVisualState(replacementButton);

    currentButton.replaceWith(replacementButton);

    replacementButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        try {
            await runGuidedResponseReliably();
        } catch (error) {
            console.error(`[${MODULE}] Guided Response failed`, error);
            globalThis.toastr?.error?.(
                'Guided Response failed. Check the console for details.',
            );
        }
    }, true);
}

function adoptGuidedGenerations() {
    const slot = document.querySelector('#em-gg-slot');
    const gg = document.querySelector('#gg-action-button-container');
    if (!slot || !gg) return false;

    if (gg.parentElement !== slot) {
        slot.appendChild(gg);
    }

    patchGuidedResponseButton();
    return true;
}

function adoptFallbackQuickReplies() {
    const ggPresent = !!document.querySelector('#gg-action-button-container');
    if (ggPresent) return;

    const slot = document.querySelector('#em-fallback-qr-slot');
    const bars = document.querySelectorAll('#qr--bar');
    const qr = Array.from(bars).at(-1);

    if (slot && qr && qr.parentElement !== slot) {
        slot.appendChild(qr);
    }
}

function adoptComposerExtensions() {
    adoptQuickPersona();
    adoptNativeOptionsButton();
    adoptLeftSendExtras();

    const hasGuidedGenerations = adoptGuidedGenerations();
    if (!hasGuidedGenerations) {
        adoptFallbackQuickReplies();
    }

    ensurePreviousSwipeButton();
}

function cleanTextareaLabels() {
    const textarea = document.querySelector('#send_textarea');
    if (!textarea) return;

    const cleanText = 'Type a message...';
    const i18nText = '[no_connection_text]Not connected to API!;[connected_text]Type a message...';

    if (textarea.getAttribute('connected_text') !== cleanText) {
        textarea.setAttribute('connected_text', cleanText);
    }

    if (textarea.getAttribute('data-i18n') !== i18nText) {
        textarea.setAttribute('data-i18n', i18nText);
    }

    const placeholder = textarea.getAttribute('placeholder') || '';
    if (placeholder.includes('/?')) {
        textarea.setAttribute('placeholder', cleanText);
    }
}

function observeTextarea() {
    const textarea = document.querySelector('#send_textarea');
    if (!textarea || textareaObserver) return;

    textareaObserver = new MutationObserver(() => cleanTextareaLabels());
    textareaObserver.observe(textarea, {
        attributes: true,
        attributeFilter: ['placeholder', 'connected_text', 'data-i18n'],
    });
}

function moveEditButtonIntoActions(message) {
    if (!(message instanceof Element)) return;

    const buttons = message.querySelector('.mes_buttons');
    if (!buttons) return;

    const extra = buttons.querySelector('.extraMesButtons');
    const edit = buttons.querySelector('.mes_edit');

    if (!extra || !edit) return;

    if (edit.parentElement !== extra) {
        edit.classList.add('em-edit-in-menu');
        extra.appendChild(edit);
    }
}

function moveAllEditButtonsIntoActions() {
    document.querySelectorAll('.mes').forEach(moveEditButtonIntoActions);
}

function observeDynamicUi() {
    if (uiObserver) return;

    uiObserver = new MutationObserver((mutations) => {
        let messagesChanged = false;
        let composerChanged = false;
        let headerMayNeedUpdate = false;

        for (const mutation of mutations) {
            if (
                mutation.target instanceof Element &&
                mutation.target.closest?.('#gg-action-button-container')
            ) {
                composerChanged = true;
            }

            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;

                if (node.matches?.('.mes') || node.querySelector?.('.mes')) {
                    messagesChanged = true;
                }

                if (
                    node.id === 'quickPersona' ||
                    node.id === 'options_button' ||
                    node.id === 'gg-action-button-container' ||
                    node.id === 'qr--bar' ||
                    node.closest?.('#leftSendForm') ||
                    node.querySelector?.(
                        '#quickPersona, #options_button, #gg-action-button-container, #qr--bar'
                    )
                ) {
                    composerChanged = true;
                }

                if (
                    node.id === 'em-mobile-header' ||
                    node.closest?.('#top-settings-holder')
                ) {
                    headerMayNeedUpdate = true;
                }
            }
        }

        if (messagesChanged) {
            moveAllEditButtonsIntoActions();
            updateSwipeNavigationButtons();
        }

        if (composerChanged) {
            requestAnimationFrame(() => {
                adoptComposerExtensions();
                cleanTextareaLabels();
                ensurePreviousSwipeButton();
            });
        }

        if (headerMayNeedUpdate) scheduleGeometryUpdate();
    });

    uiObserver.observe(document.body, { childList: true, subtree: true });
}

function bindSillyTavernEvents() {
    if (eventsBound) return;

    const ctx = getContext();
    if (!ctx?.eventSource || !ctx?.eventTypes) return;

    const events = [
        'APP_READY',
        'CHAT_CHANGED',
        'CHAT_LOADED',
        'CHAT_RENAMED',
        'CHAT_CREATED',
        'GROUP_UPDATED',
        'GROUP_CHAT_CREATED',
        'CHARACTER_RENAMED',
        'CHARACTER_EDITED',
        'PERSONA_CHANGED',
        'PERSONA_UPDATED',
        'PERSONA_RENAMED',
        'SETTINGS_UPDATED',
        'ONLINE_STATUS_CHANGED',
        'USER_MESSAGE_RENDERED',
        'CHARACTER_MESSAGE_RENDERED',
        'MESSAGE_SWIPED',
    ];

    for (const key of events) {
        const eventName = ctx.eventTypes[key];
        if (!eventName) continue;

        ctx.eventSource.on(eventName, () => {
            window.setTimeout(() => {
                buildHeader();
                buildComposer();
                updateHeader();
                adoptComposerExtensions();
                cleanTextareaLabels();
                moveAllEditButtonsIntoActions();
                ensurePreviousSwipeButton();
                syncGenerationControls();
                forceDarkBrowserChrome();
                scheduleGeometryUpdate();
            }, 30);
        });
    }

    eventsBound = true;
}

function bindOutsideClicks() {
    document.addEventListener('pointerdown', (event) => {
        if (!(event.target instanceof Element)) return;

        if (
            document.body.classList.contains('em-top-menu-open') &&
            !event.target.closest('#top-settings-holder') &&
            !event.target.closest('#em-top-menu-button') &&
            !event.target.closest('#em-panel-stage')
        ) {
            closeTopMenu();
        }

        // Keep the wand tray open while interacting with ST's native options popup,
        // Quick Persona selector, Guided Generations popups, or the tray itself.
        if (
            document.body.classList.contains('em-tools-open') &&
            !event.target.closest('#em-tool-tray') &&
            !event.target.closest('#em-tools-toggle') &&
            !event.target.closest('#options') &&
            !event.target.closest('#quickPersonaMenu') &&
            !event.target.closest('[id^="gg_"]') &&
            !event.target.closest('[id^="pg_"]') &&
            !event.target.closest('#em-guided-response-picker')
        ) {
            closeToolTray();
        }
    }, { passive: true });
}


function forceDarkBrowserChrome() {
    const color = '#101012';

    document.documentElement.style.setProperty('background-color', color, 'important');
    document.body?.style.setProperty('background-color', color, 'important');

    let theme = document.head.querySelector('meta[name="theme-color"]');
    if (!theme) {
        theme = document.createElement('meta');
        theme.setAttribute('name', 'theme-color');
        document.head.appendChild(theme);
    }
    if (theme.getAttribute('content') !== color) {
        theme.setAttribute('content', color);
    }

    let status = document.head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!status) {
        status = document.createElement('meta');
        status.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(status);
    }
    if (status.getAttribute('content') !== 'black-translucent') {
        status.setAttribute('content', 'black-translucent');
    }
}

function observeBrowserChrome() {
    if (themeColorObserver) return;

    forceDarkBrowserChrome();

    themeColorObserver = new MutationObserver(() => {
        const theme = document.head.querySelector('meta[name="theme-color"]');
        const status = document.head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

        if (
            theme?.getAttribute('content') !== '#101012' ||
            status?.getAttribute('content') !== 'black-translucent'
        ) {
            forceDarkBrowserChrome();
        }
    });

    themeColorObserver.observe(document.head, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['content'],
    });
}

function syncGenerationControls() {
    const stop = document.querySelector('#mes_stop');
    if (!stop) {
        document.body.classList.remove('em-generation-active');
        return;
    }

    const style = getComputedStyle(stop);
    const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0;

    document.body.classList.toggle('em-generation-active', visible);
}

function observeGenerationControls() {
    if (generationControlsObserver) return;

    const right = document.querySelector('#rightSendForm');
    if (!right) return;

    generationControlsObserver = new MutationObserver(() => {
        requestAnimationFrame(syncGenerationControls);
    });

    generationControlsObserver.observe(right, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden'],
    });

    syncGenerationControls();
}

function bindViewportEvents() {
    window.addEventListener('resize', scheduleGeometryUpdate, { passive: true });
    window.addEventListener('orientationchange', scheduleGeometryUpdate, { passive: true });

    window.visualViewport?.addEventListener('resize', scheduleGeometryUpdate, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleGeometryUpdate, { passive: true });
}

async function waitForReady() {
    for (let i = 0; i < 150; i++) {
        if (
            globalThis.SillyTavern?.getContext &&
            document.querySelector('#top-bar') &&
            document.querySelector('#send_form')
        ) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
}

async function init() {
    if (initialized || !isMobileLayout()) return;

    const ready = await waitForReady();
    if (!ready) {
        console.warn(`[${MODULE}] Timed out waiting for SillyTavern UI.`);
        return;
    }

    initialized = true;
    document.body.classList.add('em-mobile-ui');
    document.body.classList.remove('em-header-hidden');

    buildPanelStage();
    buildHeader();
    buildComposer();
    moveAllEditButtonsIntoActions();
    adoptComposerExtensions();
    cleanTextareaLabels();
    observeTextarea();
    observeDynamicUi();
    bindSillyTavernEvents();
    bindOutsideClicks();
    bindViewportEvents();
    observeBrowserChrome();
    observeGenerationControls();
    bindTopDrawerStaging();
    bindMessageCharacterClicks();
    bindLongPressMessageActions();
    ensurePreviousSwipeButton();
    scheduleGeometryUpdate();

    // Several third-party extensions initialize after APP_READY.
    // These retries adopt their *real* buttons without cloning behavior.
    [150, 500, 1200, 2500].forEach(delay => {
        window.setTimeout(() => {
            adoptComposerExtensions();
            cleanTextareaLabels();
            updateHeader();
            moveAllEditButtonsIntoActions();
            ensurePreviousSwipeButton();
            syncGenerationControls();
            forceDarkBrowserChrome();
            scheduleGeometryUpdate();
        }, delay);
    });

    log('Eldin Mobile UI v1.5.0 loaded.');
}

init();
