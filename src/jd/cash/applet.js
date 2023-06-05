const Template = require('../base/template');

const {sleep, writeFileJSON, singleRun} = require('../../lib/common');
const _ = require('lodash');
const {getEnv} = require('../../lib/env');

class CashApplet extends Template {
  static scriptName = 'CashApplet';
  static scriptNameDesc = '领现金-小程序(仅助力)';
  static dirname = __dirname;
  static shareCodeTaskList = [];
  static commonParamFn = () => ({});
  static activityEndTime = '';
  static times = 1;
  static cookieKeys = ['wq_uin', 'wq_skey'];

  static apiOptions = {
    options: {
      headers: {
        referer: 'https://servicewechat.com/wx91d27dbf599dff74/712/page-frame.html',
        wqreferer: 'http://wq.jd.com/wxapp/pages/ac/get_cash/pages/index/index',
      },
      qs: {
        g_ty: 'ls',
        g_tk: 1793995565,
      },
      form: {
        body: {'version': '1', 'channel': 'applet'},
        appid: 'signed_mp',
        clientVersion: '1.0.0',
        client: 'wh5',
        clientType: 'wxapp',
        loginType: '1',
        loginWQBiz: 'pet-town',
      },
    },
  };

  static async beforeRequest(api) {
    return !await this.updateWqAuthToken(api);
  }

  static async doMain(api, shareCodes) {
    const self = this;

    let needStop = !await self.updateWqAuthToken(api);
    if (needStop) throw api.clog('未登录', false);

    await handleDoTask();
    await handleDoShare();

    async function handleDoTask() {
      let doneTask = false;
      const taskList = await api.doFormBody('cash_task_info', {'remind': 0}).then(_.property('data.result'));
      for (const {duration, type} of taskList) {
        doneTask = true;
        await sleep(duration);
        await api.doFormBody('cash_doTask', {type, 'source': 2});
      }
      if (doneTask) {
        return handleDoTask();
      }
    }

    async function handleDoShare() {
      const {inviteCode, shareDate, signMoney} = await api.doFormBody('cash_mob_home').then(_.property('data.result'));
      api.log(`当前钱数: ${signMoney}`);
      if (api.isFirst) {
        self.shareCode = {inviteCode, shareDate};
      } else {
        await api.doFormBody('cash_qr_code_assist', {...self.shareCode, type: 2}).then(data => {
          if (self.isSuccess(data)) {
            api.log(`成功助力 ${data.data.result.hostPin}`);
          } else {
            api.log(data.data.bizMsg);
          }
        });
      }
    }
  }
}

singleRun(CashApplet).then();

module.exports = CashApplet;
