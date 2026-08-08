const MODULE = 'eldin_mobile_ui';
const MOBILE_QUERY = '(max-width: 1000px)';

let initialized = false;
let eventsBound = false;
let uiObserver = null;
let textareaObserver = null;
let geometryRaf = null;

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

    if ((textarea.getAttribute('placeholder') || '').includes('/?')) {
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

        if (messagesChanged) moveAllEditButtonsIntoActions();

        if (composerChanged) {
            requestAnimationFrame(() => {
                adoptComposerExtensions();
                cleanTextareaLabels();
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
    scheduleGeometryUpdate();

    // Several third-party extensions initialize after APP_READY.
    // These retries adopt their *real* buttons without cloning behavior.
    [150, 500, 1200, 2500].forEach(delay => {
        window.setTimeout(() => {
            adoptComposerExtensions();
            cleanTextareaLabels();
            updateHeader();
            moveAllEditButtonsIntoActions();
            scheduleGeometryUpdate();
        }, delay);
    });

    log('Eldin Mobile UI v1.1.0 loaded.');
}

init();
