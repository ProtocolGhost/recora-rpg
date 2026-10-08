class RecoraActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["recora", "sheet", "actor"],
      template: "systems/recora-rpg/templates/actor-sheet.html",
      width: 650,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "principal" }], // <-- OLHE ESTA VÍRGULA AQUI!
      scrollY: [".sheet-body"]
    });
  }

  async getData(options) {
    const context = await super.getData(options);

    context.isGM = game.user.isGM;
    context.canEditEnergia = game.user.isGM || this.actor.isOwner;

    let sys = foundry.utils.deepClone(context.actor.system) || {};

    sys.attributes = sys.attributes || {};
    const attrs = ["agape", "logos", "umbra", "calma", "impeto"];
    attrs.forEach(attr => {
      sys.attributes[attr] = sys.attributes[attr] || {};
      sys.attributes[attr].value = sys.attributes[attr].value || "d6";

      if (sys.attributes[attr].energia === undefined || sys.attributes[attr].energia === null) {
        sys.attributes[attr].energia = 0;
      }
    });

    sys.manaGrid = sys.manaGrid || {};
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        sys.manaGrid[`r${r}c${c}`] = sys.manaGrid[`r${r}c${c}`] || { value: "" };
      }
    }

    sys.persona = sys.persona || "";
    const pontosDesejo = Number.parseInt(sys.pontosDesejo, 10);
    sys.pontosDesejo = Number.isInteger(pontosDesejo) ? Math.min(5, Math.max(0, pontosDesejo)) : 0;
    sys.listaGatilhos = sys.listaGatilhos || [];
    sys.listaTalentos = sys.listaTalentos || [];
    sys.listaHabilidades = sys.listaHabilidades || [];
    sys.listaCronicas = sys.listaCronicas || [];

    // Novos dados de Inventário
    sys.pontosInventario = sys.pontosInventario || 0;
    sys.recursos = sys.recursos || 0;
    sys.inventarioTexto = sys.inventarioTexto || "";

    // --- Inicialização e Validação das Estatísticas ---
    sys.stats = sys.stats || {};
    sys.stats.vigor = sys.stats.vigor || { value: 10, max: 10 };
    sys.stats.saudePerigo = sys.stats.saudePerigo || { value: 3, max: 3 };
    sys.stats.saudeAtencao = sys.stats.saudeAtencao || { value: 3, max: 3 };
    sys.stats.saudeBom = sys.stats.saudeBom || { value: 3, max: 3 };

    // Garantia de segurança: se por qualquer motivo 'value' for maior que 'max', ajusta no render
    for (const key of ['vigor', 'saudePerigo', 'saudeAtencao', 'saudeBom']) {
      if (sys.stats[key].value > sys.stats[key].max) {
        sys.stats[key].value = sys.stats[key].max;
      }
    }

    context.statsPct = {
      vigor: Math.min(100, Math.max(0, Math.round(((sys.stats.vigor.value || 0) / (sys.stats.vigor.max || 1)) * 100))),
      saudePerigo: Math.min(100, Math.max(0, Math.round(((sys.stats.saudePerigo.value || 0) / (sys.stats.saudePerigo.max || 1)) * 100))),
      saudeAtencao: Math.min(100, Math.max(0, Math.round(((sys.stats.saudeAtencao.value || 0) / (sys.stats.saudeAtencao.max || 1)) * 100))),
      saudeBom: Math.min(100, Math.max(0, Math.round(((sys.stats.saudeBom.value || 0) / (sys.stats.saudeBom.max || 1)) * 100)))
    };

    // --- Inicialização da Armadura ---
    sys.armadura = sys.armadura || {};
    sys.armadura.valor = Number(sys.armadura.valor) || 2;
    sys.armadura.maxMarcadores = Number(sys.armadura.maxMarcadores ?? sys.armadura.max) || 4;
    sys.armadura.value = Number(sys.armadura.value) || 0;

    const maxArmadura = sys.armadura.maxMarcadores;
    const usadosArmadura = sys.armadura.value;

    context.armaduraMarcadores = Array.from({ length: maxArmadura }, (_, i) => ({
      checked: i < usadosArmadura
    }));

    context.system = sys;
    context.pontosDesejoMarcadores = Array.from({ length: 5 }, (_, index) => ({
      value: index + 1,
      active: index < sys.pontosDesejo
    }));
    context.diceOptions = { "d4": "d4", "d6": "d6", "d8": "d8", "d10": "d10", "d12": "d12" };

    // Cálculo automatizado do Tesouro
    context.tesouro = Math.floor(sys.recursos / 10);

    context.artefatos = this.actor.items.filter(i => i.type === "artefato") || [];

    // Configuração dos slots da Anima
    const slots = this.actor.system.slotsAnima || 6;
    context.system.slotsAnima = slots;
    context.showSlot7 = slots >= 7;
    context.showSlot8 = slots >= 8;
    context.showSlot9 = slots >= 9;

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.edit-stat-max').click(this._onEditStatMax.bind(this));
    html.find('.stat-btn-gastar').click(this._onGastarVigor.bind(this));
    html.find('.stat-btn-respiro').click(this._onRespiro.bind(this));
    html.find('.stat-btn-dano').click(this._onDano.bind(this));
    html.find('.stat-btn-restaurar').click(this._onRestaurar.bind(this));

    html.find('.edit-armadura-config').click(this._onEditArmaduraConfig.bind(this));
    html.find('.btn-consertar-armadura').click(this._onConsertarArmadura.bind(this));
    // As checkboxes de armadura são apenas visuais (disabled no HTML) e são
    // preenchidas automaticamente por _onDano / _onRestaurar. Não há mais
    // listener de clique manual aqui de propósito.

    html.find('.roll-attribute').click(this._onRollAttribute.bind(this));
    html.find('.aliviar-attribute').click(this._onAliviar.bind(this));
    html.find('.zerar-attribute').click(this._onZerar.bind(this));

    html.find('.add-ferida').click(this._onAddFerida.bind(this));
    html.find('.heal-ferida').click(this._onHealFerida.bind(this));

    html.find('.add-gatilho').click(this._onAddGatilho.bind(this));
    html.find('.edit-gatilho').click(this._onEditGatilho.bind(this));
    html.find('.delete-gatilho').click(this._onDeleteGatilho.bind(this));
    html.find('.add-talento').click(this._onAddTalento.bind(this));
    html.find('.show-talento').click(this._onShowTalento.bind(this));
    html.find('.edit-talento').click(this._onEditTalento.bind(this));
    html.find('.delete-talento').click(this._onDeleteTalento.bind(this));
    html.find('.action-roll').click(this._onActionRoll.bind(this));

    html.find('.add-habilidade').click(this._onAddHabilidade.bind(this));
    html.find('.edit-habilidade').click(this._onEditHabilidade.bind(this));
    html.find('.delete-habilidade').click(this._onDeleteHabilidade.bind(this));
    html.find('.use-habilidade').click(this._onUseHabilidade.bind(this));

    // Listeners do Novo Inventário e Artefatos
    html.find('.artefato-create').click(this._onArtefatoCreate.bind(this));
    html.find('.artefato-show').click(this._onArtefatoShow.bind(this));
    html.find('.artefato-delete').click(this._onArtefatoDelete.bind(this));
    html.find('.artefato-input').change(this._onArtefatoEdit.bind(this));

    html.find('.cronica-create').click(this._onCronicaCreate.bind(this));
    html.find('.cronica-delete').click(this._onCronicaDelete.bind(this));
    html.find('.cronica-input').change(this._onCronicaEdit.bind(this));
    html.find('.desejo-marker').click(this._onTogglePontoDesejo.bind(this));
    html.find('.desejo-marker').keydown(this._onKeydownPontoDesejo.bind(this));

    html.find('.anima-cell').each((i, el) => {
      const val = $(el).text().trim();
      if (val === 'A') $(el).css({ 'color': '#fbc02d' });
      else if (val === 'L') $(el).css({ 'color': '#42a5f5' });
      else if (val === 'U') $(el).css({ 'color': '#ab47bc' });
      else if (val === 'C') $(el).css({ 'color': '#66bb6a' });
      else if (val === 'I') $(el).css({ 'color': '#ef5350' });
      else if (val === 'F') $(el).css({ 'color': '#b71c1c', 'font-weight': 'bold' });
    });
  }

  async _onTogglePontoDesejo(event) {
    event.preventDefault();
    if (!this.actor.isOwner && !game.user.isGM) return;

    const marker = $(event.currentTarget);
    const value = Number(marker.data('value'));
    const currentValue = Number.parseInt(this.actor.system.pontosDesejo, 10) || 0;
    const newValue = marker.hasClass('active') ? Math.max(0, value - 1) : Math.min(5, value);

    if (newValue === currentValue) return;

    await this.actor.update({ "system.pontosDesejo": newValue });
    this.render(false);
  }

  _onKeydownPontoDesejo(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this._onTogglePontoDesejo(event);
  }

  // --- Funções de Artefato ---

  async _onArtefatoCreate(event) {
    event.preventDefault();
    const itemData = {
      name: "Novo Artefato",
      type: "artefato",
      system: { nivel: 1, ressonancia: "", efeito: "" }
    };
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  async _onArtefatoEdit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = $(element).closest('.artefato-item').data('item-id');
    const field = element.dataset.field;
    let value = element.value;

    if (element.type === "number") {
      value = parseInt(value) || 0;
    }

    await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, [field]: value }]);
  }

  async _onArtefatoShow(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).closest('.artefato-item').data('item-id');
    const item = this.actor.items.get(itemId);
    if (!item) return;

    let content = `
      <div style="border: 1px solid #1976d2; border-radius: 5px; padding: 10px; background: #e3f2fd;">
        <h3 style="margin-top: 0; color: #1565c0; font-weight: bold; border-bottom: 1px solid #90caf9; padding-bottom: 5px;">${item.name}</h3>
        <p style="margin: 5px 0; font-size: 13px;"><b>Nível:</b> ${item.system.nivel || 0} | <b>Ressonância:</b> ${item.system.ressonancia || "Nenhuma"}</p>
        <div style="font-size: 14px; margin-top: 10px; font-style: italic; color: #333;"><b>Efeito:</b> ${item.system.efeito || "Nenhum efeito descrito."}</div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }

  async _onArtefatoDelete(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.artefato-item');
    const itemId = li.data('item-id');

    Dialog.confirm({
      title: "Deletar Artefato",
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que quer deletar esse artefato?</p>`,
      yes: async () => {
        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      },
      defaultYes: false
    });
  }

  // --- Fim das Funções de Artefato ---

  // Manter restante das funções de Habilidades, Gatilhos e Rolagens inalteradas abaixo...
  // (As funções _onAddHabilidade, _onActionRoll, _onRollAttribute, etc., devem ser mantidas exatamente como estavam no seu código).

  async _onAddHabilidade(event) {
    event.preventDefault();

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Nome da Habilidade:</label>
          <input type="text" id="hab-nome" style="width: 100%; font-size: 14px;" autofocus />
        </div>
        
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Atributo:</label>
          <select id="hab-attr" style="width: 100%; height: 30px; font-size: 14px;">
            <option value="agape" selected>Ágape</option>
            <option value="logos">Logos</option>
            <option value="umbra">Umbra</option>
            <option value="calma">Calma</option>
            <option value="impeto">Ímpeto</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Custo de Energia:</label>
          <input type="number" id="hab-custo" value="1" style="width: 100%; text-align: center; font-size: 14px;" />
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Descrição:</label>
          <textarea id="hab-desc" style="width: 100%; height: 80px; resize: none; font-size: 14px;"></textarea>
        </div>

        <div id="hab-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: "Adicionar Habilidade",
      content: dialogContent,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Adicionar Habilidade"
        }
      },
      default: "add",
      render: html => {
        html.find('.dialog-button.add').off('click').click(async (e) => {
          e.preventDefault();

          const nome = html.find('#hab-nome').val().trim();
          const attr = html.find('#hab-attr').val();
          const custo = parseInt(html.find('#hab-custo').val()) || 0;
          const desc = html.find('#hab-desc').val().trim();
          const errorContainer = html.find('#hab-error-container');

          errorContainer.empty();

          if (custo <= 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Sua habilidade não pode ter um custo de energia menor ou igual a zero.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          if (nome) {
            const habilidades = this.actor.system.listaHabilidades || [];
            habilidades.push({ id: foundry.utils.randomID(), nome: nome, atributo: attr, custo: custo, descricao: desc });
            await this.actor.update({ "system.listaHabilidades": habilidades });
            this.render(false);
            d.close();
          }
        });
      }
    });
    d.render(true);
  }

  async _onEditHabilidade(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.habilidade-item');
    const id = li.data('id');
    const habilidades = this.actor.system.listaHabilidades || [];
    const hab = habilidades.find(h => h.id === id);

    if (!hab) return;

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Nome da Habilidade:</label>
          <input type="text" id="hab-nome" value="${hab.nome}" style="width: 100%; font-size: 14px;" autofocus />
        </div>
        
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Atributo:</label>
          <select id="hab-attr" style="width: 100%; height: 30px; font-size: 14px;">
            <option value="agape" ${hab.atributo === 'agape' ? 'selected' : ''}>Ágape</option>
            <option value="logos" ${hab.atributo === 'logos' ? 'selected' : ''}>Logos</option>
            <option value="umbra" ${hab.atributo === 'umbra' ? 'selected' : ''}>Umbra</option>
            <option value="calma" ${hab.atributo === 'calma' ? 'selected' : ''}>Calma</option>
            <option value="impeto" ${hab.atributo === 'impeto' ? 'selected' : ''}>Ímpeto</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Custo de Energia:</label>
          <input type="number" id="hab-custo" value="${hab.custo}" style="width: 100%; text-align: center; font-size: 14px;" />
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Descrição:</label>
          <textarea id="hab-desc" style="width: 100%; height: 80px; resize: none; font-size: 14px;">${hab.descricao}</textarea>
        </div>

        <div id="hab-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: "Editar Habilidade",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar Alterações"
        }
      },
      default: "save",
      render: html => {
        html.find('.dialog-button.save').off('click').click(async (e) => {
          e.preventDefault();

          const nome = html.find('#hab-nome').val().trim();
          const attr = html.find('#hab-attr').val();
          const custo = parseInt(html.find('#hab-custo').val()) || 0;
          const desc = html.find('#hab-desc').val().trim();
          const errorContainer = html.find('#hab-error-container');

          errorContainer.empty();

          if (custo <= 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Sua habilidade não pode ter um custo de energia menor ou igual a zero.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          if (nome) {
            const index = habilidades.findIndex(h => h.id === id);
            if (index !== -1) {
              habilidades[index] = { id: id, nome: nome, atributo: attr, custo: custo, descricao: desc };
              await this.actor.update({ "system.listaHabilidades": habilidades });
              this.render(false);
              d.close();
            }
          }
        });
      }
    });
    d.render(true);
  }

  async _onDeleteHabilidade(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.habilidade-item');
    const id = li.data('id');
    const habilidades = this.actor.system.listaHabilidades || [];

    Dialog.confirm({
      title: "Deletar Habilidade",
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que deseja deletar esta habilidade?</p>`,
      yes: async () => {
        const novaLista = habilidades.filter(h => h.id !== id);
        await this.actor.update({ "system.listaHabilidades": novaLista });
        this.render(false);
      },
      defaultYes: false
    });
  }

  async _onUseHabilidade(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.habilidade-item');
    const id = li.data('id');
    const habilidades = this.actor.system.listaHabilidades || [];
    const hab = habilidades.find(h => h.id === id);

    if (!hab) return;

    let currentEnergy = 0;
    if (this.actor.system.attributes[hab.atributo] && this.actor.system.attributes[hab.atributo].energia !== undefined) {
      currentEnergy = this.actor.system.attributes[hab.atributo].energia;
    }

    if (currentEnergy < hab.custo) {
      ui.notifications.error(`Você não tem energia de ${hab.atributo.toUpperCase()} suficiente para usar ${hab.nome}. Custo: ${hab.custo}`);
      return;
    }

    const newEnergy = currentEnergy - hab.custo;
    await this.actor.update({
      [`system.attributes.${hab.atributo}.energia`]: newEnergy
    });

    const attrNames = { agape: "Ágape", logos: "Logos", umbra: "Umbra", calma: "Calma", impeto: "Ímpeto" };

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div style="border: 1px solid #1976d2; border-radius: 5px; padding: 10px; background: #e3f2fd;">
          <h3 style="margin-top: 0; color: #1565c0; font-weight: bold; border-bottom: 1px solid #90caf9; padding-bottom: 5px;">${hab.nome}</h3>
          <p style="margin: 5px 0; font-size: 13px;"><b>Atributo:</b> ${attrNames[hab.atributo]} | <b>Custo:</b> ${hab.custo} Energia</p>
          <div style="font-size: 14px; margin-top: 10px; font-style: italic; color: #333;">${hab.descricao}</div>
        </div>
      `
    });
  }

  async _onActionRoll(event) {
    event.preventDefault();
    const sys = this.actor.system;
    const gatilhos = sys.listaGatilhos || [];
    const attrs = sys.attributes || {};

    let gatilhosHtml = "";
    if (gatilhos.length > 0) {
      gatilhosHtml = gatilhos.map(g => `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
          <input type="checkbox" class="gatilho-check" style="cursor: pointer; width: 16px; height: 16px;" />
          <label style="font-size: 14px;">${g.text}</label>
        </div>
      `).join("");
    } else {
      gatilhosHtml = "<p style='font-size: 13px; color: #666; font-style: italic;'>Nenhuma frase salva para usar.</p>";
    }

    const dialogContent = `
      <form id="action-roll-form">
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">ALUCI:</label>
          <select id="action-attr" style="width: 100%; height: 30px; font-size: 14px;">
            <option value="agape">Ágape</option>
            <option value="logos">Logos</option>
            <option value="umbra">Umbra</option>
            <option value="calma">Calma</option>
            <option value="impeto">Ímpeto</option>
          </select>
        </div>
        
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Impulsos de Energia:</label>
          <input type="number" id="action-impulsos" value="0" style="width: 100%; text-align: center; font-size: 16px;" />
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Vantagem e Desvantagem:</label>
          <input type="number" id="action-advantage" class="recora-native-spinner action-advantage-input" value="0" min="-2" max="2" step="1" style="width: 60px; text-align: center; font-size: 16px;" />
        </div>

        <div id="action-error-container"></div>
        
        <fieldset style="border: 1px solid #ccc; padding: 10px; border-radius: 5px; margin-top: 15px; margin-bottom: 10px;">
          <legend style="font-weight: bold;">Seus Gatilhos</legend>
          ${gatilhosHtml}
        </fieldset>
      </form>
    `;

    let d = new Dialog({
      title: "Rolagem de Ação",
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d10"></i>',
          label: "Fazer Rolagem"
        }
      },
      default: "roll",
      render: html => {
        html.find('.dialog-button.roll').off('click').click(async (e) => {
          e.preventDefault();

          const selectedAttr = html.find('#action-attr').val();
          const impulsosVal = parseInt(html.find('#action-impulsos').val()) || 0;
          const advantageInput = html.find('#action-advantage').val();
          const advantageVal = advantageInput === "" ? 0 : Number(advantageInput);
          const errorContainer = html.find('#action-error-container');
          errorContainer.empty();

          if (impulsosVal < 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 14px; text-align: center;">Seu impulso não pode ser menor que zero.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          let currentEnergy = 0;
          if (attrs[selectedAttr] && attrs[selectedAttr].energia !== undefined) {
            currentEnergy = attrs[selectedAttr].energia;
          }

          if (impulsosVal > currentEnergy) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 14px; text-align: center;">Você não tem energia suficiente para fazer esse impulso.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          if (!Number.isInteger(advantageVal) || advantageVal < -2 || advantageVal > 2) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 14px; text-align: center;">A Vantagem e Desvantagem deve estar entre -2 e 2.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          const checkedGatilhos = html.find('.gatilho-check:checked').length;
          const totalBonus = checkedGatilhos + impulsosVal;

          const attrNames = { agape: "Ágape", logos: "Logos", umbra: "Umbra", calma: "Calma", impeto: "Ímpeto" };
          const attrNameCap = attrNames[selectedAttr];

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div style="font-size: 15px;"><b>${this.actor.name}</b> fez uma rolagem com <b>${impulsosVal}</b> impulsos de <b>${attrNameCap}</b>!</div>`
          });

          let formula = "1d10";
          if (advantageVal > 0) formula = `${advantageVal + 1}d10kh1`;
          else if (advantageVal < 0) formula = `${Math.abs(advantageVal) + 1}d10kl1`;
          if (totalBonus > 0) formula += ` + ${totalBonus}`;

          let roll = new Roll(formula);
          await roll.evaluate({ async: true });

          roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }) });

          const newEnergy = currentEnergy - impulsosVal;
          await this.actor.update({ [`system.attributes.${selectedAttr}.energia`]: newEnergy });

          this.render(false);
          d.close();
        });
      }
    });
    d.render(true);
  }

  async _onAddGatilho(event) {
    event.preventDefault();
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Digite sua frase:</label>
          <input type="text" id="gatilho-text" style="width: 100%; font-size: 15px;" autofocus/>
        </div>
      </form>
    `;
    new Dialog({
      title: "Adicionar Frase de Gatilho",
      content: dialogContent,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Adicionar",
          callback: async (html) => {
            const text = html.find('#gatilho-text').val().trim();
            if (text) {
              const gatilhos = this.actor.system.listaGatilhos || [];
              gatilhos.push({ id: foundry.utils.randomID(), text: text });
              await this.actor.update({ "system.listaGatilhos": gatilhos });
              this.render(false);
            }
          }
        }
      },
      default: "add"
    }).render(true);
  }

  async _onAddTalento(event) {
    event.preventDefault();
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Nome do Talento:</label>
          <input type="text" id="talento-nome" style="width: 100%; font-size: 15px;" autofocus />
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Descrição:</label>
          <textarea id="talento-descricao" style="width: 100%; height: 100px; resize: vertical; font-size: 14px;"></textarea>
        </div>
      </form>
    `;

    new Dialog({
      title: "Adicionar Talento",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async (html) => {
            const nome = html.find('#talento-nome').val().trim();
            const descricao = html.find('#talento-descricao').val().trim();

            if (nome) {
              const talentos = this.actor.system.listaTalentos || [];
              talentos.push({ id: foundry.utils.randomID(), nome, descricao });
              await this.actor.update({ "system.listaTalentos": talentos });
              this.render(false);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onShowTalento(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.talento-item').data('id');
    const talentos = this.actor.system.listaTalentos || [];
    const talento = talentos.find(item => item.id === id);
    if (!talento) return;

    const nome = foundry.utils.escapeHTML(talento.nome || "Talento");
    const descricao = foundry.utils.escapeHTML(talento.descricao || "Nenhuma descrição informada.");

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div style="border: 1px solid #7b1fa2; border-radius: 5px; padding: 10px; background: #f3e5f5;">
          <h3 style="margin-top: 0; color: #6a1b9a; font-weight: bold; border-bottom: 1px solid #ce93d8; padding-bottom: 5px;">${nome}</h3>
          <div style="font-size: 14px; margin-top: 10px; white-space: pre-wrap; color: #333;">${descricao}</div>
        </div>
      `
    });
  }

  async _onEditTalento(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.talento-item').data('id');
    const talentos = this.actor.system.listaTalentos || [];
    const talento = talentos.find(item => item.id === id);
    if (!talento) return;

    const nomeAtual = foundry.utils.escapeHTML(talento.nome || "");
    const descricaoAtual = foundry.utils.escapeHTML(talento.descricao || "");
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Nome do Talento:</label>
          <input type="text" id="talento-nome" value="${nomeAtual}" style="width: 100%; font-size: 15px;" autofocus />
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Descrição:</label>
          <textarea id="talento-descricao" style="width: 100%; height: 100px; resize: vertical; font-size: 14px;">${descricaoAtual}</textarea>
        </div>
      </form>
    `;

    new Dialog({
      title: "Editar Talento",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async (html) => {
            const nome = html.find('#talento-nome').val().trim();
            const descricao = html.find('#talento-descricao').val().trim();

            if (nome) {
              const index = talentos.findIndex(item => item.id === id);
              if (index !== -1) {
                talentos[index] = { id, nome, descricao };
                await this.actor.update({ "system.listaTalentos": talentos });
                this.render(false);
              }
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onDeleteTalento(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.talento-item');
    const id = li.data('id');
    const talentos = this.actor.system.listaTalentos || [];

    Dialog.confirm({
      title: "Deletar Talento",
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que deseja deletar este talento?</p>`,
      yes: async () => {
        const novaLista = talentos.filter(talento => talento.id !== id);
        await this.actor.update({ "system.listaTalentos": novaLista });
        this.render(false);
      },
      defaultYes: false
    });
  }

  async _onEditGatilho(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.gatilho-item');
    const id = li.data('id');
    const gatilhos = this.actor.system.listaGatilhos || [];
    const gatilho = gatilhos.find(g => g.id === id);
    if (!gatilho) return;

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Edite sua frase:</label>
          <input type="text" id="gatilho-text" value="${gatilho.text}" style="width: 100%; font-size: 15px;" autofocus/>
        </div>
      </form>
    `;
    new Dialog({
      title: "Editar Frase de Gatilho",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async (html) => {
            const text = html.find('#gatilho-text').val().trim();
            if (text) {
              const index = gatilhos.findIndex(g => g.id === id);
              if (index !== -1) {
                gatilhos[index].text = text;
                await this.actor.update({ "system.listaGatilhos": gatilhos });
                this.render(false);
              }
            }
          }
        }
      },
      default: "save"
    }).render(true);
  }

  async _onDeleteGatilho(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.gatilho-item');
    const id = li.data('id');
    const gatilhos = this.actor.system.listaGatilhos || [];
    Dialog.confirm({
      title: "Deletar Frase de Gatilho",
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que deseja deletar esta frase?</p>`,
      yes: async () => {
        const novaLista = gatilhos.filter(g => g.id !== id);
        await this.actor.update({ "system.listaGatilhos": novaLista });
        this.render(false);
      },
      defaultYes: false
    });
  }

  async _onAddFerida(event) {
    event.preventDefault();
    const manaGrid = this.actor.system.manaGrid || {};

    const maxSlots = this.actor.system.slotsAnima || 6;
    let emptyCellKey = null;

    for (let i = 1; i <= maxSlots; i++) {
      let r = Math.ceil(i / 3);
      let c = i % 3 === 0 ? 3 : i % 3;
      const key = `r${r}c${c}`;

      if (!manaGrid[key] || manaGrid[key].value === "") {
        emptyCellKey = key;
        break;
      }
    }

    if (emptyCellKey) {
      await this.actor.update({ [`system.manaGrid.${emptyCellKey}.value`]: 'F' });
      this.render(false);
    } else {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="color: #d32f2f; font-size: 16px; font-weight: bold; text-align: center; padding: 10px; border: 2px solid #d32f2f; border-radius: 5px; background: #ffebee;">${this.actor.name} está derrotado!</div>`
      });
    }
  }

  async _onHealFerida(event) {
    event.preventDefault();
    const manaGrid = this.actor.system.manaGrid || {};
    let targetCell = null;
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const key = `r${r}c${c}`;
        if (manaGrid[key] && manaGrid[key].value === 'F') { targetCell = key; break; }
      }
      if (targetCell) break;
    }
    if (targetCell) {
      await this.actor.update({ [`system.manaGrid.${targetCell}.value`]: "" });
      this.render(false);
    }
  }

  async _onRollAttribute(event) {
    event.preventDefault();
    const diceType = event.currentTarget.dataset.roll;
    const attrName = event.currentTarget.dataset.name;
    const attrKey = event.currentTarget.dataset.key;
    const letterMap = { agape: 'A', logos: 'L', umbra: 'U', calma: 'C', impeto: 'I' };
    const letter = letterMap[attrKey];

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; margin-bottom: 5px; display: block;">Colocar bônus de tensão:</label>
          <input type="number" id="tension-bonus" value="" placeholder="Ex: 2" style="width: 100%; text-align: center; font-size: 16px;" autofocus/>
        </div>
      </form>
    `;

    let d = new Dialog({
      title: `Tensionar ${attrName}`,
      content: dialogContent,
      buttons: { roll: { icon: '🎲', label: "Rolar" }, cancel: { icon: '❌', label: "Cancelar" } },
      render: html => {
        html.find('.dialog-button.roll').off('click').click(async (e) => {
          e.preventDefault();
          const manaGrid = this.actor.system.manaGrid || {};

          const maxSlots = this.actor.system.slotsAnima || 6;
          let emptyCellKey = null;

          for (let i = 1; i <= maxSlots; i++) {
            let r = Math.ceil(i / 3);
            let c = i % 3 === 0 ? 3 : i % 3;
            const key = `r${r}c${c}`;

            if (!manaGrid[key] || manaGrid[key].value === "") {
              emptyCellKey = key;
              break;
            }
          }

          if (!emptyCellKey) {
            if (html.find('.anima-error').length === 0) {
              html.find('form').append('<p class="anima-error" style="color: #d32f2f; font-weight: bold; margin-top: 10px; text-align: center; font-size: 14px;">Você não consegue tensionar! Seu Anima já está no limite.</p>');
              d.setPosition({ height: "auto" });
            }
            return;
          }

          const bonusInput = html.find('#tension-bonus').val();
          const bonus = parseInt(bonusInput) || 0;
          let formula = `1${diceType}`;
          if (bonus > 0) formula += ` + ${bonus}`;
          else if (bonus < 0) formula += ` - ${Math.abs(bonus)}`;

          let roll = new Roll(formula);
          await roll.evaluate({ async: true });
          roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `<b>Tensionou ${attrName}</b>` });

          await this.actor.update({
            [`system.attributes.${attrKey}.energia`]: roll.total,
            [`system.manaGrid.${emptyCellKey}.value`]: letter
          });
          this.render(false);
          d.close();
        });
      }
    });
    d.render(true);
  }

  async _onAliviar(event) {
    event.preventDefault();
    const attrKey = event.currentTarget.dataset.key;
    const letterMap = { agape: 'A', logos: 'L', umbra: 'U', calma: 'C', impeto: 'I' };
    const letter = letterMap[attrKey];
    const manaGrid = this.actor.system.manaGrid || {};
    let targetCell = null;
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const key = `r${r}c${c}`;
        if (manaGrid[key] && manaGrid[key].value === letter) { targetCell = key; break; }
      }
      if (targetCell) break;
    }
    if (targetCell) {
      await this.actor.update({ [`system.manaGrid.${targetCell}.value`]: "" });
      this.render(false);
    }
  }

  async _onZerar(event) {
    event.preventDefault();
    const attrName = event.currentTarget.dataset.name;
    const attrKey = event.currentTarget.dataset.key;
    Dialog.confirm({
      title: `Zerar ${attrName}`,
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que quer Zerar em <b>${attrName}</b>?<br>Se fizer isso, sua energia voltará a ser 0.</p>`,
      yes: async () => {
        await this.actor.update({ [`system.attributes.${attrKey}.energia`]: 0 });
        this.render(false);
      },
      no: () => { },
      defaultYes: false
    });
  }

  // --- Funções de Crônicas ---
  async _onCronicaCreate(event) {
    event.preventDefault();
    const cronicas = this.actor.system.listaCronicas || [];
    cronicas.push({
      id: foundry.utils.randomID(),
      titulo: "Nova Crônica",
      descricao: "",
      completa: false
    });
    await this.actor.update({ "system.listaCronicas": cronicas });
  }

  async _onCronicaEdit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const li = $(element).closest('.cronica-item');
    const id = li.data('id');
    const field = element.dataset.field;
    let value = element.type === "checkbox" ? element.checked : element.value;

    const cronicas = this.actor.system.listaCronicas || [];
    const index = cronicas.findIndex(c => c.id === id);

    if (index !== -1) {
      cronicas[index][field] = value;
      await this.actor.update({ "system.listaCronicas": cronicas });
    }
  }

  async _onCronicaDelete(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest('.cronica-item');
    const id = li.data('id');
    const cronicas = this.actor.system.listaCronicas || [];

    Dialog.confirm({
      title: "Deletar Crônica",
      content: `<p style="text-align: center; font-size: 14px;">Tem certeza que quer deletar essa crônica?</p>`,
      yes: async () => {
        const novaLista = cronicas.filter(c => c.id !== id);
        await this.actor.update({ "system.listaCronicas": novaLista });
      },
      defaultYes: false
    });
  }

  // --- Função de Configuração de Estatísticas ---
  async _onEditStatMax(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.key;
    const stats = this.actor.system.stats || {};

    // Defaults canônicos (iguais aos usados em getData), não "value: 0".
    const canonicalDefaults = {
      vigor: { value: 10, max: 10 },
      saudePerigo: { value: 3, max: 3 },
      saudeAtencao: { value: 3, max: 3 },
      saudeBom: { value: 3, max: 3 }
    };
    const currentStat = stats[key] || canonicalDefaults[key] || { value: 1, max: 1 };

    const config = {
      vigor: { title: "Vigor", prompt: "Digite aqui o seu vigor:" },
      saudePerigo: { title: "Saúde (Perigo)", prompt: "Digite aqui a sua saúde (Perigo):" },
      saudeAtencao: { title: "Saúde (Atenção)", prompt: "Digite aqui a sua saúde (Atenção):" },
      saudeBom: { title: "Saúde (Bom)", prompt: "Digite aqui a sua saúde (Bom):" }
    };

    const statInfo = config[key] || { title: "Estatística", prompt: "Digite aqui o valor:" };

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">${statInfo.prompt}</label>
          <input type="number" id="stat-max-val" value="${currentStat.max}" min="1" step="1" style="width: 100%; text-align: center; font-size: 16px;" autofocus />
        </div>
        <div id="stat-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: `Configurar ${statInfo.title}`,
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar"
        }
      },
      default: "save",
      render: html => {
        html.find('.dialog-button.save').off('click').click(async (e) => {
          e.preventDefault();
          const newMax = parseInt(html.find('#stat-max-val').val());
          const errorContainer = html.find('#stat-error-container');
          errorContainer.empty();

          if (isNaN(newMax) || newMax <= 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Estatísticas não podem ter valor máximo menor ou igual a zero.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          // Sempre grava "value" junto com "max" (nunca deixa "value" ausente).
          // Se o valor atual já existir e for menor ou igual ao novo máximo, mantém;
          // caso contrário (ou se não existir ainda), usa o novo máximo.
          const currentValue = Number(currentStat.value);
          const newValue = (!isNaN(currentValue) && currentValue <= newMax) ? currentValue : newMax;

          const updates = {
            [`system.stats.${key}.max`]: newMax,
            [`system.stats.${key}.value`]: newValue
          };

          await this.actor.update(updates);
          this.render(false);
          d.close();
        });
      }
    });
    d.render(true);
  }

  // 1. Botão Gastar Vigor
  async _onGastarVigor(event) {
    event.preventDefault();
    const vigor = this.actor.system.stats?.vigor || { value: 0, max: 10 };

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Quanto de Vigor vai gastar?</label>
          <input type="number" id="gastar-vigor-val" value="1" min="0" step="1" style="width: 100%; text-align: center; font-size: 16px;" autofocus />
        </div>
        <div id="vigor-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: "Gastar Vigor",
      content: dialogContent,
      buttons: {
        gastar: {
          icon: '<i class="fas fa-minus-circle"></i>',
          label: "Gastar"
        },
        cancelar: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "gastar",
      render: html => {
        html.find('.dialog-button.gastar').off('click').click(async (e) => {
          e.preventDefault();
          const valInput = html.find('#gastar-vigor-val').val();
          const val = parseInt(valInput);
          const errorContainer = html.find('#vigor-error-container');
          errorContainer.empty();

          // Validação: Valor negativo
          if (isNaN(val) || val < 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Você não pode gastar uma quantidade negativa de Vigor.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          // Validação: Gastar mais do que possui
          if (val > vigor.value) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Você não tem Vigor suficiente para gastar.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          // Atualiza o vigor diminuindo a quantidade gasta
          await this.actor.update({
            "system.stats.vigor.value": vigor.value - val
          });
          d.close();
        });
      }
    });
    d.render(true);
  }

  // 2. Botão Respiro
  async _onRespiro(event) {
    event.preventDefault();
    const stats = this.actor.system.stats || {};
    const updates = {};

    // Restaura o Vigor ao Máximo sempre
    const vigorMax = stats.vigor?.max ?? 10;
    updates["system.stats.vigor.value"] = vigorMax;
    updates["system.stats.vigor.max"] = vigorMax;

    // Restaura as saúdes ao máximo APENAS se não estiverem zeradas (value > 0)
    for (const key of ['saudePerigo', 'saudeAtencao', 'saudeBom']) {
      const stat = stats[key] || { value: 3, max: 3 };
      const max = stat.max ?? 3;
      if (stat.value > 0) {
        updates[`system.stats.${key}.value`] = max;
      }
      updates[`system.stats.${key}.max`] = max;
    }

    await this.actor.update(updates);
  }

  // Botão Restaurar
  async _onRestaurar(event) {
    event.preventDefault();

    new Dialog({
      title: "Restaurar",
      content: `<p style="text-align: center; padding: 10px; font-size: 14px;">Receber 1 F para restaurar saúde zerada?</p>`,
      buttons: {
        sim: {
          icon: '<i class="fas fa-check"></i>',
          label: "Sim",
          callback: async () => {
            const stats = this.actor.system.stats || {};

            // 1. Percorre Perigo > Atenção > Bom e acha a primeira zerada
            const ordem = ['saudePerigo', 'saudeAtencao', 'saudeBom'];
            let statZerado = null;
            for (const key of ordem) {
              const stat = stats[key] || { value: 3, max: 3 };
              if (Number(stat.value) === 0) {
                statZerado = key;
                break;
              }
            }

            // Nenhuma saúde zerada: não faz nada
            if (!statZerado) return;

            // 2. Acha uma célula vazia na tabela de Anima (mesma lógica do botão Ferida)
            const manaGrid = this.actor.system.manaGrid || {};
            const maxSlots = this.actor.system.slotsAnima || 6;
            let emptyCellKey = null;

            for (let i = 1; i <= maxSlots; i++) {
              let r = Math.ceil(i / 3);
              let c = i % 3 === 0 ? 3 : i % 3;
              const key = `r${r}c${c}`;
              if (!manaGrid[key] || manaGrid[key].value === "") {
                emptyCellKey = key;
                break;
              }
            }

            // Sem espaço no Anima: erro, e a saúde não é restaurada
            if (!emptyCellKey) {
              ui.notifications.error("Seu Anima já está no limite.");
              return;
            }

            // 3. Restaura a saúde zerada ao máximo e cobra 1 F no Anima
            const maxDoStat = Number((stats[statZerado] || {}).max) || 3;
            await this.actor.update({
              [`system.stats.${statZerado}.value`]: maxDoStat,
              [`system.manaGrid.${emptyCellKey}.value`]: 'F'
            });
            this.render(false);
          }
        },
        nao: {
          icon: '<i class="fas fa-times"></i>',
          label: "Não"
        }
      },
      default: "nao"
    }).render(true);
  }

  // Botão Consertar (Armadura)
  async _onConsertarArmadura(event) {
    event.preventDefault();

    const armadura = this.actor.system.armadura || {};
    const marcadoresUsados = Number(armadura.value) || 0;

    const dialogContent = `
      <form>
        <div style="margin-bottom: 10px; text-align: center;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px; font-size: 14px; color: #333;">
            Quantos slots de armadura quer consertar?
          </label>
          <input
            type="number"
            id="consertar-armadura-input"
            class="recora-native-spinner"
            value="0"
            min="0"
            max="${marcadoresUsados}"
            step="1"
            onkeydown="return false"
            style="width: 80px; text-align: center; font-weight: bold; font-size: 16px; border: 1px solid #ccc; border-radius: 3px; height: 32px; box-sizing: border-box; cursor: pointer; display: inline-block;"
          />
        </div>
        <div id="consertar-armadura-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: "Consertar Armadura",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar"
        }
      },
      default: "save",
      render: html => {
        html.find('.dialog-button.save').off('click').click(async (e) => {
          e.preventDefault();
          const quantidade = parseInt(html.find('#consertar-armadura-input').val());
          const errorContainer = html.find('#consertar-armadura-error-container');
          errorContainer.empty();

          if (isNaN(quantidade) || quantidade <= 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">A quantidade a consertar precisa ser maior que zero.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          // Relê o valor atual no momento do clique (pode ter mudado desde a abertura do diálogo)
          const armaduraAtual = this.actor.system.armadura || {};
          const usadosAtual = Number(armaduraAtual.value) || 0;

          if (quantidade > usadosAtual) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Você não tem slots de armadura marcados suficientes para consertar.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          // Percorre da direita para a esquerda: desmarca (repara) essa
          // quantidade de checkboxes, ou seja, reduz o total de usados.
          const novosUsados = Math.max(0, usadosAtual - quantidade);

          await this.actor.update({ 'system.armadura.value': novosUsados });
          this.render(false);
          d.close();
        });
      }
    });
    d.render(true);
  }

  // --- Função de Configuração de Armadura ---
  async _onEditArmaduraConfig(event) {
    event.preventDefault();
    // Fallback campo a campo (não do objeto inteiro), para funcionar mesmo
    // quando system.armadura já existe mas está parcialmente preenchido
    // (ex: depois de um Restaurar, que só grava "value").
    const rawArmadura = this.actor.system.armadura || {};
    const armadura = {
      valor: Number(rawArmadura.valor) || 2,
      maxMarcadores: Number(rawArmadura.maxMarcadores ?? rawArmadura.max) || 4
    };

    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Valor da Armadura:</label>
          <input type="number" id="armadura-valor" value="${armadura.valor}" min="0" step="1" style="width: 100%; text-align: center; font-size: 16px;" autofocus />
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Quantidade de marcadores:</label>
          <input type="number" id="armadura-marcadores" class="recora-native-spinner" value="${armadura.maxMarcadores}" min="1" max="10" step="1" onkeydown="return false;" style="width: 80px; text-align: center; height: 30px; font-size: 16px; border: 1px solid #999; border-radius: 3px;" />
        </div>
        <div id="armadura-error-container"></div>
      </form>
    `;

    let d = new Dialog({
      title: "Configurar Armadura",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar"
        }
      },
      default: "save",
      render: html => {
        html.find('.dialog-button.save').off('click').click(async (e) => {
          e.preventDefault();
          const valor = parseInt(html.find('#armadura-valor').val());
          const marcadores = parseInt(html.find('#armadura-marcadores').val());
          const errorContainer = html.find('#armadura-error-container');
          errorContainer.empty();

          // Validação de número negativo
          if (isNaN(valor) || valor < 0) {
            errorContainer.html('<p style="color: #d32f2f; font-weight: bold; margin-top: 5px; font-size: 13px; text-align: center;">Valor da Armadura não pode ser negativo.</p>');
            d.setPosition({ height: "auto" });
            return;
          }

          const finalMarcadores = Math.min(10, Math.max(1, isNaN(marcadores) ? 4 : marcadores));

          await this.actor.update({
            "system.armadura.valor": valor,
            "system.armadura.maxMarcadores": finalMarcadores,
            "system.armadura.max": finalMarcadores
          });
          d.close();
        });
      }
    });
    d.render(true);
  }

  async _onDano(event) {
    event.preventDefault();

    new Dialog({
      title: "Receber Dano",
      content: `
      <form style="padding: 10px;">
        <div style="margin-bottom: 15px; text-align: center;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px; font-size: 14px; color: #333;">
            Dano a receber:
          </label>
          <input 
            type="number" 
            id="dano-a-receber-input" 
            class="recora-native-spinner" 
            value="0" 
            min="0" 
            step="1" 
            style="width: 80px; text-align: center; font-weight: bold; font-size: 16px; border: 1px solid #ccc; border-radius: 3px; height: 32px; box-sizing: border-box; display: inline-block;" 
            autofocus
          />
        </div>

        <div style="margin-bottom: 15px; text-align: center;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px; font-size: 14px; color: #333;">
            Slots de Armadura:
          </label>
          <input 
            type="number" 
            id="slots-armadura-input" 
            class="recora-native-spinner" 
            value="0" 
            min="0" 
            max="10" 
            step="1" 
            onkeydown="return false" 
            style="width: 80px; text-align: center; font-weight: bold; font-size: 16px; border: 1px solid #ccc; border-radius: 3px; height: 32px; box-sizing: border-box; cursor: pointer; display: inline-block;" 
          />
        </div>
      </form>
    `,
      buttons: {
        aplicar: {
          icon: '<i class="fas fa-heart-broken"></i>',
          label: "Aplicar",
          callback: async (dialogHtml) => {
            const danoInput = dialogHtml.find('#dano-a-receber-input').val();
            const danoAReceber = parseInt(danoInput);
            const slotsGastos = parseInt(dialogHtml.find('#slots-armadura-input').val()) || 0;

            // 1. Validação: Dano menor que zero
            if (isNaN(danoAReceber) || danoAReceber < 0) {
              ui.notifications.error("O dano não pode ser menor que zero.");
              return;
            }

            // Busca segura dos dados da Armadura
            const armadura = this.actor.system.armadura || {};
            const marcadoresMax = Number(armadura.maxMarcadores ?? armadura.max) || 4;
            const marcadoresUsados = Number(armadura.value) || 0;
            const slotsDisponiveis = Math.max(0, marcadoresMax - marcadoresUsados);

            // 2. Validação: Tentar gastar mais slots do que os livres
            if (slotsGastos > slotsDisponiveis) {
              ui.notifications.error("Você não tem slots de armadura suficientes.");
              return;
            }

            // 3. Cálculo de absorção e dano líquido
            const valorArmadura = Number(this.actor.system.armadura?.valor) || 2;
            const danoAbsorvido = valorArmadura * slotsGastos;
            let danoLiquido = Math.max(0, danoAReceber - danoAbsorvido);

            // Atualiza quantidade total de marcadores gastos
            const novosUsados = marcadoresUsados + slotsGastos;

            // Clona os stats de saúde, com fallback campo a campo (não do
            // objeto "stats" inteiro), usando os mesmos padrões "cheios" do
            // getData(): valor = 3 (máximo), não 0.
            const rawStats = this.actor.system.stats || {};
            const stats = {
              saudeBom: foundry.utils.deepClone(rawStats.saudeBom) || { value: 3, max: 3 },
              saudeAtencao: foundry.utils.deepClone(rawStats.saudeAtencao) || { value: 3, max: 3 },
              saudePerigo: foundry.utils.deepClone(rawStats.saudePerigo) || { value: 3, max: 3 }
            };

            // 4. Aplicação do Dano em cascata (Bom -> Atenção -> Perigo)
            if (danoLiquido > 0 && stats.saudeBom.value > 0) {
              const reduz = Math.min(stats.saudeBom.value, danoLiquido);
              stats.saudeBom.value -= reduz;
              danoLiquido -= reduz;
            }

            if (danoLiquido > 0 && stats.saudeAtencao.value > 0) {
              const reduz = Math.min(stats.saudeAtencao.value, danoLiquido);
              stats.saudeAtencao.value -= reduz;
              danoLiquido -= reduz;
            }

            if (danoLiquido > 0 && stats.saudePerigo.value > 0) {
              const reduz = Math.min(stats.saudePerigo.value, danoLiquido);
              stats.saudePerigo.value -= reduz;
              danoLiquido -= reduz;
            }

            // 5. Salva os dados atualizados (grava value E max juntos, para
            // garantir que o campo "max" nunca fique ausente no ator)
            await this.actor.update({
              "system.armadura.value": novosUsados,
              "system.stats.saudeBom.value": stats.saudeBom.value,
              "system.stats.saudeBom.max": stats.saudeBom.max,
              "system.stats.saudeAtencao.value": stats.saudeAtencao.value,
              "system.stats.saudeAtencao.max": stats.saudeAtencao.max,
              "system.stats.saudePerigo.value": stats.saudePerigo.value,
              "system.stats.saudePerigo.max": stats.saudePerigo.max
            });

            // 6. Chat em caso de derrota
            if (stats.saudePerigo.value === 0) {
              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: `<strong>${this.actor.name} está derrotado!</strong>`
              });
            }
          }
        },
        cancelar: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "aplicar"
    }).render(true);
  }
}

class RecoraNPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["recora", "sheet", "actor", "recora-npc"],
      template: "systems/recora-rpg/templates/npc-sheet.html",
      width: 500,
      height: 650
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    const sys = foundry.utils.deepClone(context.actor.system) || {};

    const nivel = Number.parseInt(sys.nivel, 10);
    sys.nivel = Number.isInteger(nivel) ? Math.max(0, nivel) : 0;

    sys.gatilho = sys.gatilho || {};
    const gatilhoMax = Number.parseInt(sys.gatilho.max, 10);
    sys.gatilho.max = Number.isInteger(gatilhoMax) ? Math.max(0, gatilhoMax) : 20;
    const gatilhoMaxAtual = Number.parseInt(sys.gatilho.maxAtual, 10);
    sys.gatilho.maxAtual = Number.isInteger(gatilhoMaxAtual)
      ? Math.min(sys.gatilho.max, Math.max(0, gatilhoMaxAtual))
      : sys.gatilho.max;
    const gatilhoValue = Number.parseInt(sys.gatilho.value, 10);
    sys.gatilho.value = Number.isInteger(gatilhoValue)
      ? Math.min(sys.gatilho.maxAtual, Math.max(0, gatilhoValue))
      : sys.gatilho.maxAtual;

    sys.condicoesGatilho = Array.isArray(sys.condicoesGatilho) ? sys.condicoesGatilho : [];
    sys.condicoesGatilho = sys.condicoesGatilho.map(condicao => {
      if (typeof condicao === "string") {
        return { id: foundry.utils.randomID(), texto: condicao, valor: 1 };
      }
      const valor = Number.parseInt(condicao.valor, 10);
      return {
        ...condicao,
        id: condicao.id || foundry.utils.randomID(),
        valor: Number.isInteger(valor) && valor >= 1 ? valor : 1
      };
    });
    sys.acoesGatilho = Array.isArray(sys.acoesGatilho) ? sys.acoesGatilho : [];
    sys.acoesGatilho = sys.acoesGatilho.map(acao => {
      const custo = Number.parseInt(acao.custo, 10);
      return {
        ...acao,
        id: acao.id || foundry.utils.randomID(),
        nome: acao.nome || "Ação sem nome",
        descricao: acao.descricao || "",
        custo: Number.isInteger(custo) && custo >= 1 ? custo : 1
      };
    });
    sys.habilidadesNpc = Array.isArray(sys.habilidadesNpc) ? sys.habilidadesNpc : [];
    sys.habilidadesNpc = sys.habilidadesNpc.map(habilidade => ({
      ...habilidade,
      id: habilidade.id || foundry.utils.randomID(),
      nome: habilidade.nome || "Habilidade sem nome",
      descricao: habilidade.descricao || ""
    }));
    sys.aluci = sys.aluci || {};
    ["agape", "logos", "umbra", "calma", "impeto"].forEach(aluci => {
      sys.aluci[aluci] = sys.aluci[aluci] || {};
      sys.aluci[aluci].defesa = sys.aluci[aluci].defesa ?? "";
    });

    context.system = sys;
    context.triggerCurrentPct = sys.gatilho.max > 0
      ? Math.min(100, Math.max(0, Math.round((sys.gatilho.value / sys.gatilho.max) * 100)))
      : 0;
    context.triggerMaxAtualPct = sys.gatilho.max > 0
      ? Math.min(100, Math.max(0, Math.round((sys.gatilho.maxAtual / sys.gatilho.max) * 100)))
      : 0;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.npc-edit-trigger-max').click(this._onEditTriggerMax.bind(this));
    html.find('.npc-trigger-input').change(this._onEditTriggerInput.bind(this));
    html.find('.npc-apply-trigger-damage').click(this._onApplyTriggerDamage.bind(this));
    html.find('.npc-apply-trigger-heal').click(this._onApplyTriggerHeal.bind(this));
    html.find('.npc-add-condition').click(this._onAddCondition.bind(this));
    html.find('.npc-edit-condition').click(this._onEditCondition.bind(this));
    html.find('.npc-apply-condition').click(this._onApplyCondition.bind(this));
    html.find('.npc-delete-condition').click(this._onDeleteCondition.bind(this));
    html.find('.npc-add-action').click(this._onAddAction.bind(this));
    html.find('.npc-edit-action').click(this._onEditAction.bind(this));
    html.find('.npc-use-action').click(this._onUseAction.bind(this));
    html.find('.npc-delete-action').click(this._onDeleteAction.bind(this));
    html.find('.npc-add-ability').click(this._onAddAbility.bind(this));
    html.find('.npc-edit-ability').click(this._onEditAbility.bind(this));
    html.find('.npc-delete-ability').click(this._onDeleteAbility.bind(this));
  }

  _getNPCScrollTop() {
    return this.element?.find('.recora-npc-container').scrollTop() || 0;
  }

  _renderNPCKeepingScroll(scrollTop) {
    this.render(false);
    setTimeout(() => {
      const container = this.element?.find('.recora-npc-container');
      if (container?.length) container.scrollTop(scrollTop);
    }, 0);
  }

  async _onEditTriggerMax(event) {
    event.preventDefault();
    const currentMax = Number.parseInt(this.actor.system.gatilho?.max, 10);
    const dialogContent = `
      <form>
        <div class="form-group">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Gatilho máximo:</label>
          <input type="number" id="npc-trigger-max" value="${Number.isInteger(currentMax) ? currentMax : 20}" min="0" step="1" style="width: 100%; text-align: center;" autofocus />
        </div>
      </form>
    `;

    new Dialog({
      title: "Configurar Gatilho",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async html => {
            const max = Number.parseInt(html.find('#npc-trigger-max').val(), 10);
            if (!Number.isInteger(max) || max < 0) return;

            const currentValue = Number.parseInt(this.actor.system.gatilho?.value, 10) || 0;
            const currentMaxAtual = Number.parseInt(this.actor.system.gatilho?.maxAtual, 10);
            const maxAtual = Number.isInteger(currentMaxAtual) ? Math.min(max, Math.max(0, currentMaxAtual)) : max;
            const scrollTop = this._getNPCScrollTop();
            await this.actor.update({
              "system.gatilho.max": max,
              "system.gatilho.maxAtual": maxAtual,
              "system.gatilho.value": Math.min(maxAtual, Math.max(0, currentValue))
            });
            this._renderNPCKeepingScroll(scrollTop);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onEditTriggerInput(event) {
    event.preventDefault();
    const field = event.currentTarget.dataset.field;
    const scrollTop = this._getNPCScrollTop();
    const gatilho = this.actor.system.gatilho || {};
    const max = Math.max(0, Number.parseInt(gatilho.max, 10) || 0);
    let maxAtual = Math.max(0, Number.parseInt(gatilho.maxAtual, 10) || 0);
    let value = Math.max(0, Number.parseInt(gatilho.value, 10) || 0);

    if (field === "maxAtual") maxAtual = Math.min(max, Number.parseInt(event.currentTarget.value, 10) || 0);
    if (field === "value") value = Math.min(maxAtual, Number.parseInt(event.currentTarget.value, 10) || 0);
    value = Math.min(value, maxAtual);

    await this.actor.update({
      "system.gatilho.maxAtual": maxAtual,
      "system.gatilho.value": value
    });
    this._renderNPCKeepingScroll(scrollTop);
  }

  async _onApplyTriggerDamage(event) {
    event.preventDefault();
    this._openTriggerAdjustmentDialog("damage");
  }

  async _onApplyTriggerHeal(event) {
    event.preventDefault();
    this._openTriggerAdjustmentDialog("heal");
  }

  _openTriggerAdjustmentDialog(type) {
    const isDamage = type === "damage";
    const title = isDamage ? "Aplicar Dano" : "Aplicar Cura";
    const label = isDamage ? "Quantidade de dano:" : "Quantidade de cura:";
    const icon = isDamage ? "fa-heart-broken" : "fa-medkit";
    const dialogContent = `
      <form>
        <div class="form-group">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">${label}</label>
          <input type="number" id="npc-trigger-adjustment" min="1" step="1" style="width: 100%; text-align: center;" autofocus />
        </div>
      </form>
    `;

    new Dialog({
      title,
      content: dialogContent,
      buttons: {
        apply: {
          icon: `<i class="fas ${icon}"></i>`,
          label: "Aplicar",
          callback: async html => {
            const amount = Number.parseInt(html.find('#npc-trigger-adjustment').val(), 10);
            if (!Number.isInteger(amount) || amount < 1) return;

            const gatilho = this.actor.system.gatilho || {};
            const max = Math.max(0, Number.parseInt(gatilho.max, 10) || 0);
            const maxAtual = Math.max(0, Number.parseInt(gatilho.maxAtual, 10) || 0);
            const value = Math.min(maxAtual, Math.max(0, Number.parseInt(gatilho.value, 10) || 0));
            const novoMaxAtual = isDamage
              ? Math.max(0, maxAtual - amount)
              : Math.min(max, maxAtual + amount);
            const novoValue = Math.min(value, novoMaxAtual);
            const scrollTop = this._getNPCScrollTop();

            await this.actor.update({
              "system.gatilho.maxAtual": novoMaxAtual,
              "system.gatilho.value": novoValue
            });
            this._renderNPCKeepingScroll(scrollTop);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "apply"
    }).render(true);
  }

  async _onAddCondition(event) {
    event.preventDefault();
    this._openConditionDialog();
  }

  async _onEditCondition(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-condition').data('id');
    const condicao = (this.actor.system.condicoesGatilho || []).find(item => item.id === id);
    if (!condicao) return;

    this._openConditionDialog(condicao);
  }

  _openConditionDialog(condicao = null) {
    const texto = condicao ? foundry.utils.escapeHTML(condicao.texto || "") : "";
    const valor = condicao?.valor || 1;
    const title = condicao ? "Editar Condição" : "Adicionar Condição";
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descrição:</label>
          <input type="text" id="npc-condition-text" value="${texto}" style="width: 100%;" autofocus />
        </div>
        <div class="form-group">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Valor de Gatilho:</label>
          <input type="number" id="npc-condition-value" value="${valor}" min="1" step="1" style="width: 100%; text-align: center;" />
        </div>
      </form>
    `;

    new Dialog({
      title,
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async html => {
            const novoTexto = html.find('#npc-condition-text').val().trim();
            const novoValor = Number.parseInt(html.find('#npc-condition-value').val(), 10);
            if (!novoTexto || !Number.isInteger(novoValor) || novoValor < 1) return;

            const condicoes = this.actor.system.condicoesGatilho || [];
            if (condicao) {
              const index = condicoes.findIndex(item => item.id === condicao.id);
              if (index !== -1) condicoes[index] = { ...condicoes[index], texto: novoTexto, valor: novoValor };
            } else {
              condicoes.push({ id: foundry.utils.randomID(), texto: novoTexto, valor: novoValor });
            }

            const scrollTop = this._getNPCScrollTop();
            await this.actor.update({ "system.condicoesGatilho": condicoes });
            this._renderNPCKeepingScroll(scrollTop);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onApplyCondition(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-condition').data('id');
    const condicao = (this.actor.system.condicoesGatilho || []).find(item => item.id === id);
    if (!condicao) return;

    const gatilho = this.actor.system.gatilho || {};
    const maxAtual = Math.max(0, Number.parseInt(gatilho.maxAtual, 10) || 0);
    const valorAtual = Math.max(0, Number.parseInt(gatilho.value, 10) || 0);
    const valorCondicao = Math.max(1, Number.parseInt(condicao.valor, 10) || 1);
    const novoValor = Math.min(maxAtual, valorAtual + valorCondicao);
    const scrollTop = this._getNPCScrollTop();

    await this.actor.update({ "system.gatilho.value": novoValor });
    this._renderNPCKeepingScroll(scrollTop);
  }

  async _onDeleteCondition(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-condition').data('id');
    const condicoes = this.actor.system.condicoesGatilho || [];

    Dialog.confirm({
      title: "Deletar Condição",
      content: `<p style="text-align: center;">Tem certeza que deseja deletar esta condição?</p>`,
      yes: async () => {
        const scrollTop = this._getNPCScrollTop();
        await this.actor.update({
          "system.condicoesGatilho": condicoes.filter(condicao => condicao.id !== id)
        });
        this._renderNPCKeepingScroll(scrollTop);
      },
      defaultYes: false
    });
  }

  async _onAddAction(event) {
    event.preventDefault();
    this._openActionDialog();
  }

  async _onEditAction(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-action').data('id');
    const acao = (this.actor.system.acoesGatilho || []).find(item => item.id === id);
    if (!acao) return;

    this._openActionDialog(acao);
  }

  _openActionDialog(acao = null) {
    const nome = acao ? foundry.utils.escapeHTML(acao.nome || "") : "";
    const descricao = acao ? foundry.utils.escapeHTML(acao.descricao || "") : "";
    const custo = acao?.custo || 1;
    const title = acao ? "Editar Ação de Gatilho" : "Adicionar Ação de Gatilho";
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nome:</label>
          <input type="text" id="npc-action-name" value="${nome}" style="width: 100%;" autofocus />
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descrição:</label>
          <textarea id="npc-action-description" style="width: 100%; height: 90px; resize: vertical;">${descricao}</textarea>
        </div>
        <div class="form-group">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Custo:</label>
          <input type="number" id="npc-action-cost" value="${custo}" min="1" step="1" style="width: 100%; text-align: center;" />
        </div>
      </form>
    `;

    new Dialog({
      title,
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async html => {
            const novoNome = html.find('#npc-action-name').val().trim();
            const novaDescricao = html.find('#npc-action-description').val().trim();
            const novoCusto = Number.parseInt(html.find('#npc-action-cost').val(), 10);
            if (!novoNome || !Number.isInteger(novoCusto) || novoCusto < 1) return;

            const acoes = this.actor.system.acoesGatilho || [];
            if (acao) {
              const index = acoes.findIndex(item => item.id === acao.id);
              if (index !== -1) acoes[index] = { ...acoes[index], nome: novoNome, descricao: novaDescricao, custo: novoCusto };
            } else {
              acoes.push({ id: foundry.utils.randomID(), nome: novoNome, descricao: novaDescricao, custo: novoCusto });
            }

            const scrollTop = this._getNPCScrollTop();
            await this.actor.update({ "system.acoesGatilho": acoes });
            this._renderNPCKeepingScroll(scrollTop);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onUseAction(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-action').data('id');
    const acao = (this.actor.system.acoesGatilho || []).find(item => item.id === id);
    if (!acao) return;

    const gatilho = this.actor.system.gatilho || {};
    const valorAtual = Math.max(0, Number.parseInt(gatilho.value, 10) || 0);
    const custo = Math.max(1, Number.parseInt(acao.custo, 10) || 1);
    if (valorAtual < custo) {
      ui.notifications.error("A criatura não tem gatilho suficiente para fazer essa ação");
      return;
    }

    const nome = foundry.utils.escapeHTML(acao.nome || "Ação");
    const descricao = foundry.utils.escapeHTML(acao.descricao || "Nenhuma descrição informada.");
    const scrollTop = this._getNPCScrollTop();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="border: 1px solid #9f4545; border-radius: 4px; padding: 10px; background: #f8e9e7;"><h3 style="margin: 0; padding-bottom: 6px; color: #7d2525; border-bottom: 1px solid #d9a7a2;">${nome}</h3><div style="margin-top: 8px; color: #111; white-space: pre-wrap;">${descricao}</div></div>`
    });

    await this.actor.update({ "system.gatilho.value": valorAtual - custo });
    this._renderNPCKeepingScroll(scrollTop);
  }

  async _onDeleteAction(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-action').data('id');
    const acoes = this.actor.system.acoesGatilho || [];

    Dialog.confirm({
      title: "Deletar Ação",
      content: `<p style="text-align: center;">Tem certeza que deseja deletar esta ação?</p>`,
      yes: async () => {
        const scrollTop = this._getNPCScrollTop();
        await this.actor.update({ "system.acoesGatilho": acoes.filter(acao => acao.id !== id) });
        this._renderNPCKeepingScroll(scrollTop);
      },
      defaultYes: false
    });
  }

  async _onAddAbility(event) {
    event.preventDefault();
    this._openAbilityDialog();
  }

  async _onEditAbility(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-ability').data('id');
    const habilidade = (this.actor.system.habilidadesNpc || []).find(item => item.id === id);
    if (!habilidade) return;

    this._openAbilityDialog(habilidade);
  }

  _openAbilityDialog(habilidade = null) {
    const nome = habilidade ? foundry.utils.escapeHTML(habilidade.nome || "") : "";
    const descricao = habilidade ? foundry.utils.escapeHTML(habilidade.descricao || "") : "";
    const title = habilidade ? "Editar Habilidade" : "Adicionar Habilidade";
    const dialogContent = `
      <form>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nome:</label>
          <input type="text" id="npc-ability-name" value="${nome}" style="width: 100%;" autofocus />
        </div>
        <div class="form-group">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descrição:</label>
          <textarea id="npc-ability-description" style="width: 100%; height: 90px; resize: vertical;">${descricao}</textarea>
        </div>
      </form>
    `;

    new Dialog({
      title,
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Salvar",
          callback: async html => {
            const novoNome = html.find('#npc-ability-name').val().trim();
            const novaDescricao = html.find('#npc-ability-description').val().trim();
            if (!novoNome) return;

            const habilidades = this.actor.system.habilidadesNpc || [];
            if (habilidade) {
              const index = habilidades.findIndex(item => item.id === habilidade.id);
              if (index !== -1) habilidades[index] = { ...habilidades[index], nome: novoNome, descricao: novaDescricao };
            } else {
              habilidades.push({ id: foundry.utils.randomID(), nome: novoNome, descricao: novaDescricao });
            }

            const scrollTop = this._getNPCScrollTop();
            await this.actor.update({ "system.habilidadesNpc": habilidades });
            this._renderNPCKeepingScroll(scrollTop);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onDeleteAbility(event) {
    event.preventDefault();
    const id = $(event.currentTarget).closest('.recora-npc-ability').data('id');
    const habilidades = this.actor.system.habilidadesNpc || [];

    Dialog.confirm({
      title: "Deletar Habilidade",
      content: `<p style="text-align: center;">Tem certeza que deseja deletar esta habilidade?</p>`,
      yes: async () => {
        const scrollTop = this._getNPCScrollTop();
        await this.actor.update({
          "system.habilidadesNpc": habilidades.filter(habilidade => habilidade.id !== id)
        });
        this._renderNPCKeepingScroll(scrollTop);
      },
      defaultYes: false
    });
  }
}

Hooks.once("init", () => {
  console.log("Recora RPG | Sistema Carregado...");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("recora-rpg", RecoraActorSheet, { types: ["character"], makeDefault: true });
  Actors.registerSheet("recora-rpg", RecoraNPCSheet, { types: ["npc"], makeDefault: true });
});