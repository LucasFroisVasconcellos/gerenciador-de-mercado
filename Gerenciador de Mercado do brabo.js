// Versão 1.0.4 — última atualização em 2025-09-11T16:38:11Z
// Versão Corrigida por Eva em 2025-09-11
// ==UserScript==
// @name         Gerenciador de Mercado do brabo
// @description  Automatiza a venda e compra de recursos no mercado premium com configurações individuais.
// @author       Lucas Frois
// @version      5.6
// @include      https://*/game.php*screen=market*
// ==/UserScript==

(function() {
    'use strict';

    // =======================================================================
    //  1. CONFIGURAÇÕES E ESTADO INICIAL
    // =======================================================================

    // Objeto para guardar as configurações padrão
    const defaultConfig = {
        wood: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        stone: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        iron: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        global: { budget_percent: 0, budget_on: false, pp_start: null, pp_stop: null, last_buy_index: 0 }
    };

    // Carrega as configurações ou usa o padrão
    let settings = JSON.parse(localStorage.getItem('marketManagerSettings_v5')) || defaultConfig;

    // Garante que configurações antigas recebam o novo parâmetro
    if (settings.global.last_buy_index === undefined) {
        settings.global.last_buy_index = 0;
    }


    createUI();
    setupEventListeners();

    // =======================================================================
    //  2. LOOPS PRINCIPAIS (TIMERS)
    // =======================================================================
    setInterval(sellResource, 7000);
    setInterval(buyResource, 8500);
    setInterval(() => { window.location.reload(); }, 300000); // Recarrega a cada 5 minutos

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

        document.getElementById('btnLigarCompra').addEventListener('click', () => {
            // NOVO: Adiciona um aviso se o orçamento não estiver ligado
            if (!settings.global.budget_on) {
                const someBuyIsOn = resources.some(res => document.getElementById(`buy_on_${res}`).checked);
                if (someBuyIsOn) {
                    alert("Atenção: A compra automática só funcionará se o Orçamento Global estiver LIGADO. Por favor, ative o orçamento.");
                }
            }

            resources.forEach(res => {
                const isChecked = document.getElementById(`buy_on_${res}`).checked;
                settings[res].buy_on = isChecked;
                updateStatusDisplay('buy', res, isChecked);
            });
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
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings)); // Salva o estado do orçamento
            updateBudgetDisplay();
        });

        document.getElementById('btnDesligarBudget').addEventListener('click', () => {
            settings.global.budget_on = false;
            settings.global.pp_start = null;
            settings.global.pp_stop = null;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings)); // Salva o estado do orçamento
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
        ['wood', 'stone', 'iron'].forEach((res, index) => {
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

            // ===== LÓGICA DE VENDA CORRIGIDA =====
            // A venda só ocorre se o excedente for MAIOR OU IGUAL à base de venda (packet_size)
            if (surplus >= resConfig.packet_size && resData.price <= resConfig.sell_rate_cap) {
                // A quantidade a vender é exatamente a base de venda configurada.
                let amountToSell = resConfig.packet_size;
                if (amountToSell > 0) {
                    performTransaction('sell', resName, amountToSell);
                    return; // Sai após iniciar uma transação
                }
            }
        }
    }

    // ================================================================
    //  FUNÇÃO DE COMPRA COM VERIFICAÇÃO DE ORÇAMENTO CORRIGIDA
    // ================================================================
    function buyResource() {
        // Checagem inicial se o orçamento está ligado
        if (!settings.global.budget_on) return;

        let currentPP = parseInt(document.getElementById("premium_points").innerText);
        // Checagem inicial se o orçamento já foi atingido
        if (settings.global.pp_stop && currentPP <= settings.global.pp_stop) {
            document.getElementById("btnDesligarBudget").click();
            return;
        }

        const allResInfo = getResInfo();
        const maxStorage = parseInt(document.getElementById("storage").innerText);
        const resourceOrder = ['wood', 'stone', 'iron'];
        let startIndex = settings.global.last_buy_index || 0;

        for (let i = 0; i < resourceOrder.length; i++) {
            let currentIndex = (startIndex + i) % resourceOrder.length;
            const resName = resourceOrder[currentIndex];
            const resConfig = settings[resName];

            if (!resConfig.buy_on) continue;

            const resData = allResInfo[resName];
            let warehouseSpace = maxStorage - resData.inVillage;
            let buyableAmount = resData.market_capacity;

            if (resData.price >= resConfig.buy_rate && buyableAmount >= resConfig.buy_min_q) {
                let buyThis = Math.min(buyableAmount, resConfig.buy_max_q, warehouseSpace);

                if (buyThis >= resConfig.buy_min_q) {
                    // =================================================================
                    //  NOVA VERIFICAÇÃO DE ORÇAMENTO ANTES DE CADA COMPRA
                    // =================================================================
                    // Calcula o custo em PP da transação. O preço é 'recursos por 1 PP'.
                    // Math.ceil arredonda para cima para garantir que não gastemos mais do que o previsto.
                    let transactionCost = Math.ceil(buyThis / resData.price);

                    // Verifica se a compra não ultrapassará o orçamento
                    if ((currentPP - transactionCost) >= settings.global.pp_stop) {
                        // Se a compra for válida, define o próximo recurso e executa a transação
                        settings.global.last_buy_index = (currentIndex + 1) % resourceOrder.length;
                        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));

                        performTransaction('buy', resName, buyThis);
                        return; // Sai após iniciar uma transação para esperar o próximo ciclo
                    } else {
                        // Se a compra for exceder o limite, desliga o orçamento e para a execução.
                        console.log("Orçamento excederia com esta compra. Desligando a compra automática.");
                        document.getElementById("btnDesligarBudget").click();
                        return;
                    }
                }
            }
        }

        // Se o loop terminar sem compras, atualiza o índice para recomeçar do início no próximo ciclo
        settings.global.last_buy_index = (startIndex + 1) % resourceOrder.length;
        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
    }

})();
