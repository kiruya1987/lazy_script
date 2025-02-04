const Template = require('../base/template');

const {sleep, writeFileJSON, singleRun, replaceObjectMethod} = require('../../lib/common');
const {getMoment} = require('../../lib/moment');
const _ = require('lodash');

class BSign extends Template {
  static scriptName = 'BSign';
  static scriptNameDesc = '签到提现(极简模式)';
  static dirname = __dirname;
  static shareCodeTaskList = [];
  static commonParamFn = () => ({
    body: {'activityId': 'FIz2zkvbepstVFm3uqLOUA', 'linkId': 'FIz2zkvbepstVFm3uqLOUA'},
    appid: 'activities_platform',
    client: 'ios',
    clientVersion: '12.1.0',
    'x-api-eid-token': 'jdd03ZPNNW3TV6YVBDF6LALDR2XZXJIOXG7DOZCOE5KWDM52NKDQPTVI2DNJBTLINK7PEB5D6KDHQSFP3ME3ELYDTW3PZHQAAAAMKQ3IWJWYAAAAACR6VHNAIZBQJJUX',
  });
  static keepIndependence = true;
  static needInAppComplete1 = true;
  static times = 1;
  static activityEndTime = '2023-12-31';

  static apiOptions() {
    return {
      options: {
        headers: {
          origin: 'https://h5platform.jd.com',
          'referer': 'https://h5platform.jd.com/swm-stable/BVersion-sign-in/index?channel=2&activityId=FIz2zkvbepstVFm3uqLOUA&jumpFrom=1&sid=&un_area=19_1601_36953_50400',
        },
      },
    };
  }

  static async beforeRequest(api) {
    const self = this;
    self.injectEncryptH5st(api, {
      config: {
        bSignInHome: {appId: '76674'},
        bSignInDo: {appId: '61e2b'},
        apsDoTask: {appId: '54ed7'},
        apTaskDrawAward: {appId: '6f2b6'},
      },
      signFromSecurity: true,
    });
  }

  static async doMain(api, shareCodes) {
    const self = this;

    await self.beforeRequest(api);

    await handleDoSign();
    await handleDoTask();
    const {signInCoin} = await api.doFormBody('bSignInHome').then(_.property('data'));
    api.log(`当前金额: ${signInCoin}`);

    async function handleDoSign() {
      const {signInFlag} = await api.doFormBody('bSignInHome').then(_.property('data'));
      // 签到
      if (signInFlag === 0) {
        await api.doFormBody('bSignInDo').then(result => {
          if (result.success) {
            api.log(`签到成功, 金额: ${result.data.signInCoin}, 红包: ${_.get(result, 'data.bsignInPrizeDrawVO.prizeValue', 0)}`);
          } else {
            api.log(result);
          }
        });
      }
    }

    async function handleDoTask() {
      const taskList = await api.doFormBody('apTaskList').then(_.property('data'));
      for (const {
        id: taskId,
        taskType,
        taskSourceUrl: itemId,
        taskTitle,
        taskFinished,
        canDrawAwardNum
      } of taskList || []) {
        if (taskTitle.match('下单') || (taskFinished && !canDrawAwardNum)) continue;
        const body = {
          taskType,
          taskId,
          itemId,
        };
        !canDrawAwardNum && await api.doFormBody('apsDoTask', body);
        await sleep(2);
        await api.doFormBody('apTaskDrawAward', body);
      }
    }

  }
}

singleRun(BSign).then();

module.exports = BSign;
