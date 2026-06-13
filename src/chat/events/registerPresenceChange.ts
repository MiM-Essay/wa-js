/*!
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { internalEv } from '../../eventEmitter';
import {
  ChatstateModel,
  ContactStore,
  PresenceStore,
} from '../../whatsapp';

internalEv.on('conn.main_ready', () => {
  // Kraya patch — do NOT auto-subscribe presence for every chat on connect.
  //
  // Upstream fires one presence-subscribe stanza per chat in ChatStore, in
  // parallel, the instant the session reaches `conn.main_ready` — before any
  // message is sent. On an account with a large chat roster this is a burst of
  // hundreds of stanzas that WhatsApp's anti-abuse system reads as an automation
  // tool, and is a leading cause of accounts being restricted with zero messages
  // sent. Kraya never consumes the `chat.presence_change` event, so this
  // subscription is pure ban risk with no benefit. We keep register() so the
  // event wiring stays intact (it simply never fires without subscriptions).
  register();
});

function register() {
  PresenceStore.on('change:chatstate.type', (chatstate: ChatstateModel) => {
    // Search presence model from chatstate
    const presence = PresenceStore.getModelsArray().find(
      (m) => m.chatstate === chatstate
    );

    // Ignore not initialized presences
    if (!presence || !presence.hasData || !presence.chatstate?.type) {
      return;
    }

    queueMicrotask(() => {
      const contact = ContactStore.get(presence.id);

      const data: any = {
        id: presence.id,
        isOnline: presence.isOnline,
        isGroup: presence.isGroup,
        isUser: presence.isUser,
        shortName: contact ? contact.formattedShortName : '',
        state: presence.chatstate?.type,
        t: Date.now(),
      };

      if (presence.isUser) {
        data.isContact = !presence.chatstate?.deny;
      }

      if (presence.isGroup) {
        data.participants = presence.chatstates
          .getModelsArray()
          .filter((c) => !!c.type)
          .map((c) => {
            const contact = ContactStore.get(c.id);

            return {
              id: c.id.toString(),
              state: c.type,
              shortName: contact ? contact.formattedShortName : '',
            };
          });
      }

      internalEv.emit('chat.presence_change', data);
    });
  });
}
