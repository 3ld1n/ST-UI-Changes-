const MODULE = 'eldin_mobile_ui';
const MOBILE_QUERY = '(max-width: 1000px)';

let initialized = false;
let eventsBound = false;
let uiObserver = null;
let textareaObserver = null;
let geometryRaf = null;
let activePanelStage = null;
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

    closeTopMenu();
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

function stageDrawerAfterNativeToggle(drawer) {
    window.setTimeout(() => {
        const content =
            drawer?.querySelector(':scope > .drawer-content') ||
            (activePanelStage?.drawer === drawer ? activePanelStage.content : null);

        if (!content) return;

        const isOpen =
            content.classList.contains('openDrawer') ||
            getComputedStyle(content).display !== 'none';

        if (isOpen) {
            stageNativePanel(drawer, content);
        }
    }, 0);
}

function bindTopDrawerStaging() {
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;

        const toggle = event.target.closest('#top-settings-holder .drawer > .drawer-toggle');
        if (!toggle) return;

        const drawer = toggle.closest('.drawer');
        if (!drawer) return;

        stageDrawerAfterNativeToggle(drawer);
    });
}

function openCurrentChatDetails() {
    const holder = document.querySelector('#rightNavHolder');
    const toggle = holder?.querySelector(':scope > .drawer-toggle');
    const panel = document.querySelector('#right-nav-panel');

    if (!holder || !toggle || !panel) return;

    revealHeader();
    closeToolTray();
    closeTopMenu();

    const finishOpen = () => {
        document.querySelector('#rm_button_selected_ch')?.click();
        stageNativePanel(holder, panel);
    };

    if (activePanelStage?.content === panel) {
        finishOpen();
        return;
    }

    const alreadyOpen =
        panel.classList.contains('openDrawer') ||
        getComputedStyle(panel).display !== 'none';

    if (!alreadyOpen) {
        toggle.click();
    }

    window.setTimeout(finishOpen, 30);
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
            '.mes[is_user="false"] .name_text, .mes[is_user="false"] .mesAvatarWrapper .avatar'
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
    lastChatScrollTop = chat.scrollTop;

    chat.addEventListener('scroll', () => {
        const current = chat.scrollTop;
        const delta = current - lastChatScrollTop;

        if (document.body.classList.contains('em-panel-open')) {
            revealHeader();
            lastChatScrollTop = current;
            return;
        }

        if (delta > 7 && current > 90) {
            hideHeader();
        } else if (delta < -6 || current < 45) {
            revealHeader();
        }

        lastChatScrollTop = current;
    }, { passive: true });
}

function buildPreviousSwipeButton() {
    if (document.querySelector('#em-prev-swipe-button')) return;

    const button = makeButton(
        'em-prev-swipe-button',
        'Previous swipe',
        'fa-solid fa-backward'
    );
    button.classList.add('em-history-swipe-button');

    button.addEventListener('click', () => {
        const nativeLeft = document.querySelector('.last_mes .swipe_left');
        if (!nativeLeft || button.disabled) return;

        nativeLeft.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));

        window.setTimeout(updatePreviousSwipeButton, 50);
    });

    const ggSwipe = document.querySelector('#gg_swipe_button');
    if (ggSwipe?.parentElement) {
        ggSwipe.parentElement.insertBefore(button, ggSwipe);
        return;
    }

    const ggSlot = document.querySelector('#em-gg-slot');
    if (ggSlot) {
        ggSlot.prepend(button);
    }
}

function updatePreviousSwipeButton() {
    const button = document.querySelector('#em-prev-swipe-button');
    if (!button) return;

    const lastMessage =
        document.querySelector('#chat .mes.last_mes') ||
        document.querySelector('#chat .mes:last-of-type');

    const swipeId = Number(lastMessage?.getAttribute('swipeid') ?? 0);
    const canGoBack = Number.isFinite(swipeId) && swipeId > 0;

    button.disabled = !canGoBack;
    button.setAttribute('aria-disabled', String(!canGoBack));
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

    updatePreviousSwipeButton();
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

function adoptGuidedGenerations() {
    const slot = document.querySelector('#em-gg-slot');
    const gg = document.querySelector('#gg-action-button-container');
    if (!slot || !gg) return false;

    if (gg.parentElement !== slot) {
        slot.appendChild(gg);
    }

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
            updatePreviousSwipeButton();
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
            !event.target.closest('#em-top-menu-button')
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
            !event.target.closest('[id^="pg_"]')
        ) {
            closeToolTray();
        }
    }, { passive: true });
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
    bindTopDrawerStaging();
    bindMessageCharacterClicks();
    bindAutoHideHeader();
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
            scheduleGeometryUpdate();
        }, delay);
    });

    log('Eldin Mobile UI v1.2.0 loaded.');
}

init();
