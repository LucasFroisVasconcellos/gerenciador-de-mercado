// Versão 1.0.3 — última atualização em 2025-09-11T16:21:48Z
// Versão Corrigida por Eva em 2025-09-11 (Aplicado na base do usuário)
// ==UserScript==
// @name         Gerenciador de Mercado do brabo
// @description  Automatiza a venda e compra de recursos no mercado premium com configurações individuais.
// @author       Lucas Frois
// @version      5.7
// @include      https://*/game.php*screen=market*
// ==/UserScript==

(function() {
    'use strict';

    // =======================================================================
    //  1. CONFIGURAÇÕES E ESTADO INICIAL
    // =======================================================================

    const defaultConfig = {
        wood: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        stone: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        iron: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        global: { budget_percent: 0, budget_on: false, pp_start: null, pp_stop: null }
    };

    let settings = JSON.parse(localStorage.getItem('marketManagerSettings_v5')) || defaultConfig;

    createUI();
    setupEventListeners();

    // =======================================================================
    //  2. LOOPS PRINCIPAIS (TIMERS)
    // =======================================================================
    setInterval(sellResource, 7000);
    setInterval(buyResource, 8500);
    setInterval(() => { window.location.reload(); }, 300000);

    // =======================================================================
    //  3. CRIAÇÃO DA INTERFACE (UI)
    // =======================================================================
    function createUI() {
        const userInputParent = document.getElementById("premium_exchange_form");
        const container = document.createElement("div");
        container.id = "marketManagerContainer";
        container.style.cssText = "display: flex; justify-content: space-between; gap: 10px;";

        const resources = ['wood', 'stone', 'iron'];
        const resourceNames = { wood: 'Madeira', stone: 'Argila', iron: 'Ferro' };
        const resourceIcons = {
            wood: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/wood_18x16.png',
            stone: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/stone_18x16.png',
            iron: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/iron_18x16.png'
        };

        let sellUI = `
            <div class="vis" style="flex: 1; padding: 10px;">
                <h3 style="text-align:center;">Venda Automática</h3>
                <table class="vis" style="width: 100%;">
                    <tr>
                        <th>Recurso</th>
                        ${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}
                    </tr>
                    <tr>
                        <td><strong>Status</strong></td>
                        ${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="sell_on_${res}" ${settings[res].sell_on ? 'checked' : ''}><br><span id="sell_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].sell_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Manter armazem acima de</td>
                        ${resources.map(res => `<td><input type="text" id="sell_res_cap_${res}" value="${settings[res].sell_res_cap || ''}" placeholder="ex: 500" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Vender se preço &le;</td>
                        ${resources.map(res => `<td><input type="text" id="sell_rate_cap_${res}" value="${settings[res].sell_rate_cap || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Base de venda</td>
                        ${resources.map(res => `<td><input type="text" id="packet_size_${res}" value="${settings[res].packet_size || ''}" placeholder="ex: 900" style="width: 80%;"></td>`).join('')}
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 10px;">
                    <button id="btnLigarVenda" class="btn">Aplicar Venda (Selecionados)</button>
                    <button id="btnDesligarVenda" class="btn">Desligar Venda (Todos)</button>
                </div>
            </div>
        `;

        let buyUI = `
            <div class="vis" style="flex: 1; padding: 10px;">
                <h3 style="text-align:center;">Compra Automática</h3>
                <table class="vis" style="width: 100%;">
                    <tr>
                        <th>Recurso</th>
                        ${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}
                    </tr>
                    <tr>
                        <td><strong>Status</strong></td>
                        ${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="buy_on_${res}" ${settings[res].buy_on ? 'checked' : ''}><br><span id="buy_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].buy_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Comprar se preço &ge;</td>
                        ${resources.map(res => `<td><input type="text" id="buy_rate_${res}" value="${settings[res].buy_rate || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Compra Mínima</td>
                        ${resources.map(res => `<td><input type="text" id="buy_min_q_${res}" value="${settings[res].buy_min_q || ''}" placeholder="ex: 100" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Compra Máxima</td>
                        ${resources.map(res => `<td><input type="text" id="buy_max_q_${res}" value="${settings[res].buy_max_q || ''}" placeholder="ex: 1000" style="width: 80%;"></td>`).join('')}
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 10px;">
                    <button id="btnLigarCompra" class="btn">Aplicar Compra (Selecionados)</button>
                    <button id="btnDesligarCompra" class="btn">Desligar Compra (Todos)</button>
                </div>
            </div>
        `;

        let globalControlsUI = `
            <div class="vis" style="margin-top: 10px; padding: 10px; text-align: center;">
                <h3>Controles Globais</h3>
                Orçamento em %: <input type="text" id="global_budget_percent" value="${settings.global.budget_percent || ''}" placeholder="ex: 20" style="width: 80px;">
                <button id="btnLigarBudget" class="btn">Ligar Orçamento</button>
                <button id="btnDesligarBudget" class="btn">Desligar Orçamento</button>
                <button id="btnSalvar" class="btn" style="background-color: #4CAF50;">Salvar Configurações</button>
                <div id="budget_status_display" style="margin-top: 5px; font-weight: bold; font-size: 12px;"></div>
            </div>
        `;

        container.innerHTML = sellUI + buyUI;
        const mainContainer = document.createElement('div');
        mainContainer.innerHTML = `<hr>` + container.outerHTML + globalControlsUI;
        userInputParent.parentNode.insertBefore(mainContainer, userInputParent.nextSibling);
        updateBudgetDisplay();
    }

    // =======================================================================
    //  4. LÓGICA DOS CONTROLES (EVENT LISTENERS)
    // =======================================================================
    function setupEventListeners() {
        const resources = ['wood', 'stone', 'iron'];

        document.getElementById('btnSalvar').addEventListener('click', () => {
            resources.forEach(res => {
                settings[res].sell_res_cap = parseInt(document.getElementById(`sell_res_cap_${res}`).value) || 0;
                settings[res].sell_rate_cap = parseInt(document.getElementById(`sell_rate_cap_${res}`).value) || 0;
                settings[res].packet_size = parseInt(document.getElementById(`packet_size_${res}`).value) || 0;
                settings[res].buy_rate = parseInt(document.getElementById(`buy_rate_${res}`).value) || 0;
                settings[res].buy_min_q = parseInt(document.getElementById(`buy_min_q_${res}`).value) || 0;
                settings[res].buy_max_q = parseInt(document.getElementById(`buy_max_q_${res}`).value) || 0;
            });
            settings.global.budget_percent = parseInt(document.getElementById('global_budget_percent').value) || 0;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Configurações de valores salvas!');
            location.reload();
        });

        document.getElementById('btnLigarVenda').addEventListener('click', () => {
            resources.forEach(res => {
                const isChecked = document.getElementById(`sell_on_${res}`).checked;
                settings[res].sell_on = isChecked;
                updateStatusDisplay('sell', res, isChecked);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Status de Venda salvo conforme selecionado!');
        });

        document.getElementById('btnDesligarVenda').addEventListener('click', () => {
            resources.forEach(res => {
                document.getElementById(`sell_on_${res}`).checked = false;
                settings[res].sell_on = false;
                updateStatusDisplay('sell', res, false);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Venda desativada e salva para todos os recursos!');
        });

        // ALTERADO: Lógica do botão "Ligar Compra" para incluir o aviso de orçamento
        document.getElementById('btnLigarCompra').addEventListener('click', () => {
            let isTryingToBuy = false;
            resources.forEach(res => {
                const isChecked = document.getElementById(`buy_on_${res}`).checked;
                if(isChecked) {
                    isTryingToBuy = true;
                }
                settings[res].buy_on = isChecked;
                updateStatusDisplay('buy', res, isChecked);
            });

            if(isTryingToBuy && !settings.global.budget_on) {
                alert('Atenção: Para a compra automática funcionar, o Orçamento precisa estar ligado. Por favor, ative o orçamento.');
            }

            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Status de Compra salvo conforme selecionado!');
        });

        document.getElementById('btnDesligarCompra').addEventListener('click', () => {
            resources.forEach(res => {
                document.getElementById(`buy_on_${res}`).checked = false;
                settings[res].buy_on = false;
                updateStatusDisplay('buy', res, false);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Compra desativada e salva para todos os recursos!');
        });

        document.getElementById('btnLigarBudget').addEventListener('click', () => {
            let currentPP = parseInt(document.getElementById("premium_points").innerText);
            let budgetPercent = parseInt(document.getElementById('global_budget_percent').value) || settings.global.budget_percent;

            if (isNaN(currentPP) || isNaN(budgetPercent) || budgetPercent <= 0) {
                alert("Por favor, defina um orçamento de PP válido em %.");
                return;
            }
            let ppToSpend = currentPP * (budgetPercent / 100);
            settings.global.pp_start = currentPP;
            settings.global.pp_stop = currentPP - ppToSpend;
            settings.global.budget_on = true;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            updateBudgetDisplay();
        });

        document.getElementById('btnDesligarBudget').addEventListener('click', () => {
            settings.global.budget_on = false;
            settings.global.pp_start = null;
            settings.global.pp_stop = null;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            updateBudgetDisplay();
        });
    }

    // =======================================================================
    //  5. FUNÇÕES AUXILIARES
    // =======================================================================
    function updateBudgetDisplay() {
        let display = document.getElementById("budget_status_display");
        if (settings.global.budget_on && settings.global.pp_start && settings.global.pp_stop) {
            display.textContent = `Orçamento Ativo: Gastar ${Math.round(settings.global.pp_start - settings.global.pp_stop)} PP. Parar em ${Math.round(settings.global.pp_stop)} PP.`;
        } else {
            display.textContent = "Orçamento Inativo.";
        }
    }

    function updateStatusDisplay(type, resource, isOn) {
        const statusSpan = document.getElementById(`${type}_status_${resource}`);
        if (statusSpan) {
            statusSpan.textContent = isOn ? 'Ligado' : 'Desligado';
        }
    }

    function getResInfo() {
        const resources = {};
        ['wood', 'stone', 'iron'].forEach((res) => {
            resources[res] = {
                price: parseInt(document.getElementById(`premium_exchange_rate_${res}`).children[0].innerText),
                inVillage: parseInt(document.getElementById(res).innerText),
                market_capacity: parseInt(document.getElementById(`premium_exchange_capacity_${res}`).innerHTML)
            };
        });
        return resources;
    }

    function performTransaction(type, resource, amount) {
        document.querySelectorAll(`input.premium-exchange-input[data-type="${type}"]`).forEach(el => el.value = "");
        document.querySelector(`input.premium-exchange-input[name="${type}_${resource}"]`).value = Math.floor(amount);
        document.getElementsByClassName("btn-premium-exchange-buy")[0].click();
        setTimeout(() => {
            const confirmButton = document.querySelector(".btn-confirm-yes");
            if (confirmButton) confirmButton.click();
        }, 1200);
    }

    // =======================================================================
    //  6. LÓGICA DE VENDA E COMPRA
    // =======================================================================
    function sellResource() {
        let merchAvail = document.getElementById("market_merchant_available_count").textContent;
        if (merchAvail < 1) return;

        const allResInfo = getResInfo();
        for (const resName of ['wood', 'stone', 'iron']) {
            const resConfig = settings[resName];
            if (!resConfig.sell_on) continue;

            const resData = allResInfo[resName];
            let surplus = resData.inVillage - resConfig.sell_res_cap;

            if (surplus >= resConfig.packet_size && resData.price <= resConfig.sell_rate_cap) {
                let amountToSell = resConfig.packet_size;
                if (amountToSell > 0) {
                    performTransaction('sell', resName, amountToSell);
                    return;
                }
            }
        }
    }

    // ALTERADO: Função de compra para incluir a verificação PREDITIVA do orçamento
    function buyResource() {
        if (!settings.global.budget_on) return;

        let currentPP = parseInt(document.getElementById("premium_points").innerText);
        if (settings.global.pp_stop && currentPP <= settings.global.pp_stop) {
            document.getElementById("btnDesligarBudget").click();
            return;
        }

        const allResInfo = getResInfo();
        const maxStorage = parseInt(document.getElementById("storage").innerText);

        for (const resName of ['wood', 'stone', 'iron']) {
            const resConfig = settings[resName];
            if (!resConfig.buy_on) continue;

            const resData = allResInfo[resName];
            let warehouseSpace = maxStorage - resData.inVillage;
            let buyableAmount = resData.market_capacity;

            if (resData.price >= resConfig.buy_rate && buyableAmount >= resConfig.buy_min_q) {
                let buyThis = Math.min(buyableAmount, resConfig.buy_max_q, warehouseSpace);

                if (buyThis >= resConfig.buy_min_q) {
                    // NOVO: Verificação preditiva do custo em PP para não estourar o orçamento
                    if (typeof PremiumExchange === 'object' && typeof PremiumExchange.calculateCosts === 'function') {
                        const cost = PremiumExchange.calculateCosts(resName, buyThis).pp;
                        if ((currentPP - cost) < settings.global.pp_stop) {
                            continue; // Esta compra ultrapassaria o orçamento. Tenta o próximo recurso.
                        }
                    }

                    performTransaction('buy', resName, buyThis);
                    return; // Sai após a primeira transação bem-sucedida
                }
            }
        }
    }

})();
