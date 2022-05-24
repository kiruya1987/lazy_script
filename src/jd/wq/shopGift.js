const Template = require('./index');

const path = require('path');
const fs = require('fs');
const {sleep, writeFileJSON, singleRun, getRealUrl, getUrlDataFromFile} = require('../../lib/common');
const _ = require('lodash');
const {doPolling} = require('../../lib/cron');
const shopGiftUrlPath = path.resolve(__dirname, 'shopGift.url');
const {getMoment} = require('../../lib/moment');

class ShopGift extends Template {
  static scriptName = 'ShopGift';
  static scriptNameDesc = '店铺(web)-收藏有礼';
  static concurrent = true;

  static customApiOptions = {
    uri: 'https://wq.jd.com/fav_snsgift',
    headers: {
      referer: 'https://shop.m.jd.com/',
    },
    qs: {
      sceneval: 2,
    },
  };

  static shopUrlFormatted = false;
  static shopData = [];
  static shopSignUrlUpdated = false;

  static async doMain(api, shareCodes, onlyUpdateShopSignToken) {
    const self = this;
    const isFirstRun = api.currentCookieTimes === 0;
    const doPath = (functionId, qs) => api.doPath(functionId, void 0, {qs});

    await doPolling({
      async beforePollFn() {
        if (isFirstRun) {
          const next = await handleFormat();
          fs.writeFileSync(shopGiftUrlPath, '');
          for (const {venderId} of self.shopData) {
            updateShopSignToken(venderId);
            await sleep();
          }
          return next;
        }
      },
      stopFn: () => self.shopUrlFormatted,
    });

    if (onlyUpdateShopSignToken) {
      return;
    }

    for (const {shopId, venderId} of self.shopData) {
      await getGif(shopId, venderId);
    }

    if (isFirstRun && self.shopSignUrlUpdated) {
      console.log('自动执行signShop');
      await sleep(30);
      console.log(require('child_process').execSync('npm run start:SignShop').toString());
    }

    async function handleFormat() {
      const urls = getUrlDataFromFile(shopGiftUrlPath);
      for (const url of urls) {
        const realUrl = await getRealUrl(url);
        const shopId = new URL(realUrl).searchParams.get('shopId');
        const venderId = await getVenderId(shopId);
        self.shopData.push({shopId, venderId});
      }
      self.shopUrlFormatted = true;
    }

    async function getGif(shopId, venderId) {
      if (!venderId) return api.log(`${shopId} 不存在`);
      const {giftId, activeId, jingBean} = await doPath('QueryShopActive', {venderId}).then(data => {
        return (data['gift'] || []).find(o => o['giftType'] === 0 && o['state'] === 1) || {};
      });

      if (!giftId) return api.log(`${shopId} 没有关注礼包`);
      if (!jingBean) return api.log(`${shopId} 没有豆豆礼包`);

      await api.delFavShop(shopId);
      await doPath('addfavgiftshop', {venderId});
      await doPath('GiveShopGift', {venderId, giftId, activeId}).then(data => {
        if (data['retCode'] !== 0) return api.log(`${shopId} errMsg: ${data['errMsg']}`);
        api.log(`${shopId} 获取到豆豆: ${jingBean['sendCount']}`);
      });
      await api.delFavShop(shopId);
    }

    async function updateShopSignToken(venderId) {
      await api.doGetUrl('https://wq.jd.com/shopbranch/GetUrlSignDraw', {
        qs: {
          channel: 1,
          venderId,
          _: getMoment().valueOf(),
          g_login_type: 1,
          callback: 'getUrlSignDraw',
          g_tk: 239007826,
          g_ty: 'ls',
          appCode: 'msc588d6d5',
        },
      }).then(data => {
        const isvUrl = _.get(data, 'data.isvUrl') || '';
        if (isvUrl) {
          self.shopSignUrlUpdated = true;
          fs.writeFileSync(path.resolve(__dirname, '../sign/shopToken.url'), `\n${decodeURIComponent(isvUrl)}\n`, {flag: 'a'});
        }
      });
    }

    async function getVenderId(shopId) {
      if (!shopId) return;
      return api.commonDo({
        uri: 'https://shop.m.jd.com',
        qs: {shopId},
        ignorePrintLog: true,
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        },
      }).then(data => {
        if (!_.isString(data)) return;
        const match = data.match(/venderId\s*:\s*['"]\w*['"]/);
        if (!match) return;
        return match[0].replace(/venderId\s*:\s*['"]/, '').replace(/['"]/, '');
      });
    }
  }

  static async doCron(api) {
    await this.doMain(api, void 0, true);
  }
}

singleRun(ShopGift, ['start', 'cron']);

module.exports = ShopGift;
