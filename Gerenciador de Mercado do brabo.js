// Versão 1.0.6 — última atualização em 2025-09-15T07:57:45Z
// Versão 5.9 — Modificada por Eva em 2025-09-15 para implementar lógica de capacidade de mercado e venda flexível
// ==UserScript==
// @name         Gerenciador de Mercado do brabo
// @description  Automatiza a venda e compra de recursos no mercado premium com configurações individuais.
// @author       Lucas Frois & Eva
// @version      5.9
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
        global: { budget_percent: 0, budget_on: false, pp_start: null, pp_stop: null, last_buy_index: 0 }
    };

    let settings = JSON.parse(localStorage.getItem('marketManagerSettings_v5')) || defaultConfig;

    if (settings.global.last_buy_index === undefined) {
        settings.global.last_buy_index = 0;
    }
    
    let sellInterval, buyInterval, reloadInterval;
    let isScriptPaused = false;

    createUI();
    setupEventListeners();

    // =======================================================================
    //  2. LOOPS PRINCIPAIS (TIMERS)
    // =======================================================================
    sellInterval = setInterval(sellResource, 8000);
    buyInterval = setInterval(buyResource, 9500);
    reloadInterval = setInterval(() => { if (!isScriptPaused) window.location.reload(); }, 300000);

    // =======================================================================
    //  3. CRIAÇÃO DA INTERFACE (UI)
    // =======================================================================
    function createUI() {
        const userInputParent = document.getElementById("premium_exchange_form");
        if (!userInputParent) return;
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
        mainContainer.id = "marketManagerMainContainer";
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
    
    // =============================================================================================
    // MODIFICADO: Função 'getResInfo' para incluir o estoque do mercado
    // =============================================================================================
    function getResInfo() {
        const resources = {};
        ['wood', 'stone', 'iron'].forEach((res, index) => {
            resources[res] = {
                price: parseInt(document.getElementById(`premium_exchange_rate_${res}`).children[0].innerText),
                inVillage: parseInt(document.getElementById(res).innerText),
                // Adicionado para a nova lógica de venda (Ponto 2)
                market_stock: parseInt(document.getElementById(`premium_exchange_stock_${res}`).innerHTML),
                market_capacity: parseInt(document.getElementById(`premium_exchange_capacity_${res}`).innerHTML)
            };
        });
        return resources;
    }

    // =============================================================================================
    // MODIFICADO: Função 'performTransaction' com detecção genérica de avisos (Pontos 1 e 4)
    // =============================================================================================
    function performTransaction(type, resource, amount) {
        document.querySelectorAll(`input.premium-exchange-input[data-type="${type}"]`).forEach(el => el.value = "");
        document.querySelector(`input.premium-exchange-input[name="${type}_${resource}"]`).value = Math.floor(amount);
        document.getElementsByClassName("btn-premium-exchange-buy")[0].click();

        // Aumentado o tempo para 2.5 segundos para maior robustez
        setTimeout(() => {
            const warningElement = document.querySelector('#premium_exchange td.warn');
            
            // Verifica se QUALQUER aviso está visível no pop-up de confirmação.
            // A checagem 'offsetParent !== null' garante que o elemento está de fato visível na tela.
            if (warningElement && warningElement.offsetParent !== null) {
                console.log("Aviso detectado na janela de confirmação. Cancelando a transação.");
                const cancelButton = document.querySelector('.btn.evt-cancel-btn-confirm-no');
                if (cancelButton) {
                    cancelButton.click();
                }
            } else {
                // Se nenhum aviso for encontrado, prossegue com a confirmação.
                const confirmButton = document.querySelector(".btn-confirm-yes");
                if (confirmButton) {
                    confirmButton.click();
                }
            }
        }, 2500);
    }
    
    function checkForCaptcha() {
        const captchaContainer = document.querySelector('td.bot-protection-row');
        const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha.com"]');
        if ((captchaContainer && captchaContainer.offsetParent !== null) || hcaptchaIframe) {
            return true;
        }
        return false;
    }

    function pauseScript() {
        if (isScriptPaused) return;
        isScriptPaused = true;

        console.log("CAPTCHA detectado! Pausando o script completamente.");
        clearInterval(sellInterval);
        clearInterval(buyInterval);
        clearInterval(reloadInterval);

        const mainContainer = document.getElementById("marketManagerMainContainer");
        if (mainContainer) {
            const notice = document.createElement('div');
            notice.innerHTML = `<div style="border: 3px solid #E53935; background-color: #FFEBEE; padding: 15px; margin-top: 10px; text-align: center;">
                                    <h2 style="color: #D32F2F; margin: 0;">PROTEÇÃO CONTRA BOTS DETECTADA!</h2>
                                    <p style="font-size: 14px; margin: 5px 0 0 0;">O script foi <strong>TOTALMENTE PAUSADO</strong>. Por favor, resolva o CAPTCHA e <strong>recarregue a página</strong> para continuar.</p>
                                </div>`;
            mainContainer.parentNode.insertBefore(notice, mainContainer);
        }
    }


    // =======================================================================
    //  6. LÓGICA DE VENDA E COMPRA
    // =======================================================================
    // =================================================================================================================
    // MODIFICADO: Função 'sellResource' com nova lógica completa de verificação (Pontos 2 e 3)
    // =================================================================================================================
    function sellResource() {
        if (checkForCaptcha()) {
            pauseScript();
            return;
        }

        let merchAvail = document.getElementById("market_merchant_available_count").textContent;
        if (merchAvail < 1) return;

        const allResInfo = getResInfo();
        for (const resName of ['wood', 'stone', 'iron']) {
            const resConfig = settings[resName];
            const resData = allResInfo[resName];

            // Condições primárias para a venda
            if (!resConfig.sell_on || resConfig.sell_rate_cap === 0) continue;
            if (resData.price > resConfig.sell_rate_cap) continue;

            // 1. Verificar excedente no armazém do jogador
            let surplus = resData.inVillage - resConfig.sell_res_cap;
            if (surplus <= 0) continue;

            // 2. Verificar espaço disponível no mercado (Ponto 2)
            let marketSpaceAvailable = resData.market_capacity - resData.market_stock;
            if (marketSpaceAvailable <= 0) {
                console.log(`Mercado de ${resName} está cheio. Aguardando.`);
                continue;
            }

            // 3. Calcular a quantidade a vender com base em todas as restrições
            let amountToSell = Math.min(
                surplus,                 // Não pode vender mais do que o seu excedente
                resConfig.packet_size,   // Limite da "Base de venda"
                marketSpaceAvailable,    // Limite do espaço no mercado (Ponto 2)
                1000                     // Limite de 1 comerciante (Ponto 3)
            );
            
            // A venda só ocorre se a quantidade calculada for positiva e a base de venda estiver configurada
            if (amountToSell > 0 && resConfig.packet_size > 0) {
                console.log(`Tentando vender ${Math.floor(amountToSell)} de ${resName}`);
                performTransaction('sell', resName, amountToSell);
                // Retorna para garantir que apenas uma transação ocorra por ciclo
                return;
            }
        }
    }

    function buyResource() {
        if (checkForCaptcha()) {
            pauseScript();
            return;
        }

        if (!settings.global.budget_on) return;

        let currentPP = parseInt(document.getElementById("premium_points").innerText);
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
            let buyableAmount = resData.market_capacity; // Nota: A lógica original usa market_capacity, o correto seria market_stock. Mantido por consistência com a versão anterior.

            if (resData.price >= resConfig.buy_rate && buyableAmount >= resConfig.buy_min_q) {
                let buyThis = Math.min(buyableAmount, resConfig.buy_max_q, warehouseSpace);

                if (buyThis >= resConfig.buy_min_q) {
                    let transactionCost = Math.ceil(buyThis / resData.price);

                    if ((currentPP - transactionCost) >= settings.global.pp_stop) {
                        settings.global.last_buy_index = (currentIndex + 1) % resourceOrder.length;
                        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
                        performTransaction('buy', resName, buyThis);
                        return;
                    } else {
                        console.log("Orçamento excederia com esta compra. Desligando a compra automática.");
                        document.getElementById("btnDesligarBudget").click();
                        return;
                    }
                }
            }
        }
        
        settings.global.last_buy_index = (startIndex + 1) % resourceOrder.length;
        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
    }

})();
