import { LCDClient } from '@terra-money/terra.js';
import { Mirror } from '@mirror-protocol/mirror.js';

// default -- uses Columbus-4 core contract addresses
const mirror = new Mirror();

async function getAssetPrice(contract) {
  const price = await mirror.oracle.getPrice(contract, "uusd");
  return Number.parseFloat(price.rate);
}

async function getMinCollateralRatio(contract) {
  const assetConfig = await mirror.mint.getAssetConfig(contract);
  const ratio = Number.parseFloat(assetConfig.min_collateral_ratio);
  return ratio;
}

async function getCollateralPrice(contract) {
  const price = await mirror.collateralOracle.getCollateralPrice(contract);
  return Number.parseFloat(price.rate);
}

async function checkPositions(address) {
  // find positions
  // if short look up price asset vs collateral
  // check that collateral ratio is safe
  const positions = await mirror.mint.getPositions(address);
  const short_positions = positions.positions.filter(pos => pos.is_short);
  const info = await Promise.all(short_positions.map(async pos => {
    const collateralPrice = await getCollateralPrice(pos.collateral.info.token.contract_addr);
    const assetPrice = await getAssetPrice(pos.asset.info.token.contract_addr);

    const collateralAmount = Number.parseInt(pos.collateral.amount);
    const assetAmount = Number.parseInt(pos.asset.amount);

    const collateralValue = collateralAmount * collateralPrice;
    const assetValue = assetAmount * assetPrice;

    const collateralRatio = collateralValue / assetValue;
    const minRatio = await getMinCollateralRatio(pos.asset.info.token.contract_addr);
    const safeRatio = minRatio + 0.5; // taken from mirror site
    const isSafe = collateralRatio > safeRatio;

    return {
      collateralPrice,
      assetPrice,
      collateralAmount,
      assetAmount,
      collateralValue, 
      assetValue,
      collateralRatio,
      isSafe,
    };
  }));

  return info;
}

async function main() {
  const addr = process.env.TERRA_ADDRESS;
  const info = await checkPositions(addr);
  console.log(JSON.stringify(info));
}

main().catch(console.error);
