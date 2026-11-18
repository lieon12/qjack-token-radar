// FarmPlan: one protocol's farm plan, derived from its own snapshot record.
//
// Every step is built from the protocol's category, its chains, its TVL and its
// age — never from a hand-written list of names. The same module runs in two
// places: main.ts (through lib/model.ts) writes the steps into board.json, and
// the dashboard (as a plain script) renders them in the detail view, so the
// board, the page and the screenshots always show the same plan.
//
// UMD: in the browser it sets window.FarmPlan; under Node it exports the
// functions, so one implementation serves both sides with no copy.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FarmPlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** The gas cost of one ordinary transaction on a chain, in the words a farmer pays. */
  function gasOn(chain) {
    var c = (chain || '').toLowerCase();
    if (c === 'ethereum') return { tx: 'about $4 of gas', week: 'about $4 of gas a week' };
    if (c === 'solana') return { tx: 'under $0.10 of fees', week: 'under $0.10 of fees a week' };
    if (c === 'bitcoin') return { tx: 'about $2 of network fees', week: 'about $2 of fees a week' };
    if (c === 'tron') return { tx: 'about $0.30 of energy fees', week: 'about $0.30 of fees a week' };
    if (c === 'hyperliquid l1' || c === 'hyperliquid') return { tx: 'under $0.10 of fees', week: 'under $0.10 of fees a week' };
    if (c === 'sui' || c === 'aptos' || c === 'near') return { tx: 'under $0.10 of fees', week: 'under $0.10 of fees a week' };
    // Every other chain here is an EVM L2 or a low-fee L1.
    return { tx: 'about $0.50 of gas', week: 'about $0.50 of gas a week' };
  }

  /** How much capital one farm position needs, from the protocol's own TVL. */
  function capitalFor(tvlUsd) {
    if (tvlUsd >= 1_000_000_000) return 250;
    if (tvlUsd >= 250_000_000) return 150;
    if (tvlUsd >= 100_000_000) return 100;
    return 50;
  }

  /** How long to hold, from the protocol's age: younger protocols get a longer window. */
  function holdDaysFor(ageDays) {
    if (ageDays === null || ageDays === undefined) return 30;
    if (ageDays < 180) return 60;
    if (ageDays < 365) return 45;
    return 30;
  }

  /** The first chain a protocol names, or a neutral phrase. */
  function chainOf(p) {
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }

  /**
   * The category's two actions: the position to open, and the second qualifying
   * action that proves the wallet is a real user. Each returns the action text
   * with the capital and chain already in it.
   */
  function actionsFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var half = Math.max(10, Math.round(capital / 2));
    var quarter = Math.max(10, Math.round(capital / 4));
    if (c.indexOf('lend') >= 0 || c.indexOf('collateral') >= 0) {
      return [
        'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the supply position open, so the wallet counts as an active lender.',
        'Borrow $' + half + ' of a stable asset against the supply and repay it within the week, so the position shows both sides of the market.'
      ];
    }
    if (c.indexOf('cdp') >= 0) {
      return [
        'Lock $' + capital + ' of ETH as collateral in ' + name + ' on ' + chain + ' and mint its stable asset against it, keeping the ratio well above liquidation.',
        'Repay $' + quarter + ' of the minted stable asset and re-mint it a week later, so the vault shows repeated use.'
      ];
    }
    if (c.indexOf('dex') >= 0) {
      return [
        'Provide $' + capital + ' of liquidity to ' + name + "'s largest pool on " + chain + ' and keep the position open through at least one fee cycle.',
        'Swap $' + half + ' through ' + name + ' on ' + chain + ' once a week, using a different pair each time.'
      ];
    }
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) {
      return [
        'Deposit $' + capital + ' into ' + name + "'s highest-TVL vault on " + chain + ' and leave it compounding.',
        'Claim the vault yield once it passes $5 and redeposit it the same day, so the wallet shows a claim and a fresh deposit.'
      ];
    }
    if (c.indexOf('rwa') >= 0) {
      return [
        'Mint $' + capital + ' of ' + name + "'s yield-bearing asset on " + chain + ' and hold it in the farming wallet.',
        'Top the position up by $' + quarter + ' after a week, so the wallet shows two separate mints.'
      ];
    }
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('basis') >= 0 || c.indexOf('options') >= 0) {
      return [
        'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position, sized so a 10% move cannot liquidate it.',
        'Close the hedge and open a fresh one the next week, keeping the margin on the protocol between trades.'
      ];
    }
    if (c.indexOf('risk curator') >= 0 || c.indexOf('capital allocator') >= 0) {
      return [
        'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the farming wallet.',
        'Move $' + half + ' between two of the vault markets once, so the wallet shows curation activity as well as a deposit.'
      ];
    }
    if (c.indexOf('restak') >= 0) {
      return [
        'Restake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token in the farming wallet.',
        'Delegate $' + half + ' of the receipt to a second operator, so the wallet shows two restaking actions.'
      ];
    }
    if (c.indexOf('staking') >= 0) {
      return [
        'Stake $' + capital + ' through ' + name + "'s pool on " + chain + ' and keep the staking receipt.',
        'Claim the staking rewards once they pass $5 and restake them the same day.'
      ];
    }
    if (c.indexOf('stable') >= 0) {
      return [
        'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it in the farming wallet.',
        'Swap $' + half + ' of the stable asset out and back once, so the wallet shows both a mint and a trade.'
      ];
    }
    if (c.indexOf('insurance') >= 0) {
      return [
        'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy in the farming wallet.',
        'Extend the cover by $' + quarter + ' before the first policy lapses, so the wallet shows a renewal.'
      ];
    }
    if (c.indexOf('chain') >= 0) {
      return [
        'Bridge $' + capital + ' to ' + chain + " through " + name + "'s official bridge and use it in one app on the chain the same day.",
        'Make one transaction a week on ' + chain + ' through ' + name + ', so the wallet stays active on the chain.'
      ];
    }
    if (c.indexOf('bridge') >= 0) {
      return [
        'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app the same day.',
        'Bridge $' + half + ' back a week later, so the wallet shows traffic in both directions.'
      ];
    }
    if (c.indexOf('prediction') >= 0) {
      return [
        'Fund $' + capital + ' and place one market position on ' + name + ', sized so a loss costs under $10.',
        'Settle or close the position and open a new one the next week, keeping funds on the protocol between markets.'
      ];
    }
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) {
      return [
        'Fund $' + capital + ' into ' + name + ' on ' + chain + ' and make one payment through it.',
        'Make a second payment of $' + half + ' a week later, so the wallet shows repeated use.'
      ];
    }
    if (c.indexOf('governance') >= 0) {
      return [
        'Lock $' + capital + ' of the governance asset in ' + name + ' on ' + chain + ' and vote in one live proposal.',
        'Vote in a second proposal the following week, keeping the lock open through both votes.'
      ];
    }
    if (c.indexOf('privacy') >= 0) {
      return [
        'Deposit $' + capital + ' through ' + name + "'s private pool on " + chain + ' and keep the note.',
        'Withdraw to a fresh address after a week, so the wallet shows a full private round trip.'
      ];
    }
    if (c.indexOf('index') >= 0) {
      return [
        'Buy $' + capital + ' of ' + name + "'s index token on " + chain + ' and hold it in the farming wallet.',
        'Add $' + quarter + ' to the index position after a week, so the wallet shows two buys.'
      ];
    }
    if (c.indexOf('otc') >= 0) {
      return [
        'Place $' + capital + ' in an escrowed trade on ' + name + ' and complete it in full.',
        'Complete a second trade of $' + half + ' a week later, so the wallet shows repeated volume.'
      ];
    }
    if (c.indexOf('cedefi') >= 0) {
      return [
        'Deposit $' + capital + ' into ' + name + "'s custody vault on " + chain + ' and keep the vault shares.',
        'Move $' + half + ' between two of the vault strategies once, so the wallet shows active management.'
      ];
    }
    return [
      'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.',
      'Make a second deposit of $' + half + ' a week later, so the wallet shows repeated use.'
    ];
  }

  /** One step as a single string: its action, then its cost and time, within 20..600 characters. */
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s += ' Hold the position and check the protocol’s own page.';
    return s;
  }

  /**
   * A protocol's farm plan: eight steps, each an action with a cost and a time.
   * The plan is derived from the protocol's own record (category, chains, TVL,
   * age), never from a hand-written list of names.
   */
  function farmSteps(p, ageDays) {
    var chain = chainOf(p);
    var gas = gasOn(chain);
    var capital = capitalFor(p.tvl_usd);
    var hold = holdDaysFor(ageDays);
    var acts = actionsFor(p, capital, chain);
    return [
      {
        text: 'Open a fresh wallet that holds only the funds you plan to farm with ' + p.name + ', and keep its seed phrase offline — never share it with anyone who messages you first.',
        cost: gas.tx + ' for the first transaction',
        time: '5 minutes'
      },
      { text: acts[0], cost: '$' + capital + ' of capital and ' + gas.tx, time: '15 minutes to set up' },
      { text: acts[1], cost: gas.tx, time: '10 minutes' },
      {
        text: 'Repeat one qualifying action each week on ' + p.name + ' — a deposit, a swap, a vote or a claim — so the wallet stays active across snapshots.',
        cost: gas.week,
        time: '10 minutes a week'
      },
      {
        text: 'Hold the position for at least ' + hold + ' days so the activity spans more than one snapshot window.',
        cost: 'the $' + capital + ' stays in the position',
        time: hold + ' days'
      },
      {
        text: 'Open ' + p.name + "'s own points or rewards page from its official site and check the wallet's standing; claim only from a link the protocol itself publishes.",
        cost: 'no fee to check, and never pay to claim',
        time: '10 minutes'
      },
      {
        text: 'Set a reminder to unwind in tranches if ' + p.name + "'s TVL falls by a third or its rewards page goes silent — withdraw half first, then the rest.",
        cost: gas.tx + ' per withdrawal',
        time: '15 minutes'
      },
      {
        text: 'Record the wallet, the dates, the amounts and every transaction hash in a farm log, so the position can be repeated or audited.',
        cost: 'nothing but the log',
        time: '5 minutes'
      }
    ].map(stepText);
  }

  return { farmSteps: farmSteps, stepText: stepText, capitalFor: capitalFor, holdDaysFor: holdDaysFor, gasOn: gasOn };
});
