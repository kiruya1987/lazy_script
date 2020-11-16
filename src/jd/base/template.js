const Base = require('./index');

const {sleep, writeFileJSON} = require('../../lib/common');
const moment = require('moment-timezone');

const shareCodeCaches = [];

class Template extends Base {
  static scriptName = 'Template';
  static shareCodeTaskList = [];
  static apiOptions = {
    formatDataFn: data => data,
  };

  static apiNamesFn() {
    const self = this;
    const _ = this._;

    return {
      // 获取任务列表
      getTaskList: {
        name: 'getTaskList',
        paramFn: _.noop,
        successFn: _.noop,
      },
      // 做任务
      doTask: {
        name: 'doTask',
        paramFn: _.noop,
        successFn: _.noop,
      },
      doWaitTask: {
        name: 'doWaitTask',
      },
      // 任务之后, 一般来说是兑换之类的
      doRedeem: {
        name: 'doRedeem',
        paramFn: _.noop,
        successFn: _.noop,
        repeat: true,
      },
    };
  }

  static initShareCodeTaskList(shareCodes) {
    if (shareCodes) {
      // do something to shareCodeTaskList
    }
  }

  // doMain一般不会被重载
  static async doMain(api, shareCodes) {
    const self = this;
    const _ = this._;

    // 这个会不断被赋值, TODO 在 base 里赋值可能会好点
    self._api = api;

    self.initShareCodeTaskList(shareCodes);
    const taskList = await self.doApi(api, 'getTaskList') || [];

    for (const {list, option = {}} of taskList) {
      option.firstFn = option.firstFn || (item => self.doApi(api, 'doTask', item));
      option.afterWaitFn = option.afterWaitFn || (item => self.doApi(api, 'doWaitTask', item));
      await self.loopCall(list, option);
    }

    if (self.isLastLoop()) {
      await self.doApi(api, 'doRedeem');
    }
  }
}

module.exports = Template;
