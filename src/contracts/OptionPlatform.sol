 // SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/base/Multicall.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";


import "utils/structs/tokenAddresses.sol";

/// @title NFT positions
/// @notice Wraps Uniswap V3 positions in the ERC721 non-fungible token interface
contract OptionPlatform is
    Multicall,
    IERC721Receiver
{
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using LowGasSafeMath for uint160;
    using LowGasSafeMath for int160;
    INonfungiblePositionManager public immutable UniswapNFTManager =  INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

  struct OptionInfo {
        address payable originalOwner;
        address payable currentOwner;
        address tokenLong;
        address paymentToken;
        uint256 tokenId;
        uint256 costToExercise; 
        uint256 premium; // in ETH
        uint256 optionPayout; //in tokenLong
        uint256 amountToReturn; //in paymentToken
        uint256 expiryDate;
        bool forSale;
    } 

    mapping(uint256 => OptionInfo) public itemIdToOptionInfo;
    mapping(uint256 => uint256) public itemIdToIndex;
    mapping(uint256 => TokenAddresses) public itemIdToTokenAddrs;
    mapping(address => uint256) tokenBalances;
    uint256[] public itemIds;
    uint256 private marketplaceFee; // fee taken from seller, where a 1.26% fee is represented as 126. Calculate fee by doing premium * marketplaceFee / 10,000
    address private _owner;
    address[] tokens;
    mapping(address => bool) tokensExist;

    constructor(address payable currOwner, uint256 fee) {
        _owner = currOwner;
        marketplaceFee = fee;
    }


    /**
    Sets owner of new smart contract.
     */
    function setOwner(address payable newOwner) public {
        require(msg.sender == _owner, "Unauthorized action");
        _owner = newOwner;
    }

    function changeFee(uint256 fee) public {
        require(msg.sender == _owner, "Unauthorized action");
        marketplaceFee = fee;
    }

    /**
    Returns array of all item Ids
     */
    function getAllItemIds() external view returns (uint256[] memory) {
        return itemIds;
    }

    //function that receives an NFT from an external source.
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
    Caches token Addresses on chain */
    function cacheTokenAddrs(uint256 tokenId) private {
        (
            ,
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
           
        ) = UniswapNFTManager.positions(tokenId);
        if (tokensExist[token0] == false) {
            tokens.push(token0);
            tokensExist[token0] = true;
        }
        if (tokensExist[token1] == false){
            tokens.push(token1);
            tokensExist[token1] = true;
        }
        itemIdToTokenAddrs[tokenId] = TokenAddresses({ token0Addr: token0, token1Addr: token1 });
        
    }



    //For now we will use the lower end of the price range
    function getExercisePrice(uint256 tokenId,uint128 percentage, address tokenLong) private returns (uint256) {

         (
            ,
            ,
            address token0,
            address token1,
            ,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
           
        ) = UniswapNFTManager.positions(tokenId);

    uint160 sqrtRatioLower = TickMath.getSqrtRatioAtTick(tickLower); //sqrt of the ratio of the two assets (token1/token0)
    uint160 sqrtRatioUpper = TickMath.getSqrtRatioAtTick(tickUpper);
    if (tokenLong == token1) {
        return LiquidityAmounts.getAmount0ForLiquidity(sqrtRatioLower, sqrtRatioUpper, liquidity * percentage/100);

    } 
    if (tokenLong == token0) {
        return LiquidityAmounts.getAmount1ForLiquidity(sqrtRatioLower, sqrtRatioUpper, liquidity * percentage/100);

    }

    
    }

    //FOR TESTING ONLY TODO: REMOVE WHEN DONE
    function returnToOriginalOwner(uint256 tokenId) external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        UniswapNFTManager.safeTransferFrom(address(this),optionInfo.originalOwner, tokenId);
        removeItem(tokenId);

    }

    // returns in form (optionPayout, amountToReturn)
    function placeTokensInEscrow(uint256 tokenId, uint128 percentage, address tokenLong) private returns (uint256, uint256) {
        (
            ,
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            uint128 liquidity,
            ,
            ,
            ,
           
        ) = UniswapNFTManager.positions(tokenId);
        require(percentage > 0 && percentage <= 100, "invalid percentage");


        (uint256 token0Amt, uint256 token1Amt) = UniswapNFTManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId: tokenId, 
            liquidity: uint128(liquidity)* percentage/100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 100
            }));
        uint256 optionPayout;
        if (token0 == tokenLong) {

            return (token0Amt, token1Amt);
        }
       if (token1 == tokenLong) {
            return (token1Amt, token0Amt);
        }


    }


    //premium is in the units of the currency that the seller is being paid in. The opposite of the currency to long.
    function createLongOption(uint256 tokenId, uint256 premium, uint256 duration, uint128 percentage, address tokenLong) external {
        UniswapNFTManager.safeTransferFrom(msg.sender, address(this), tokenId);

        cacheTokenAddrs(tokenId);
        itemIds.push(tokenId);
        itemIdToIndex[tokenId] = itemIds.length - 1;
        TokenAddresses memory tokenAddrs = itemIdToTokenAddrs[tokenId];
        address tokenToPayIn = address(0);
        require(tokenLong == tokenAddrs.token0Addr || tokenLong == tokenAddrs.token1Addr, "token to long is not in the position");
        if (tokenLong == tokenAddrs.token0Addr) {
            tokenToPayIn = tokenAddrs.token1Addr;
        } else if (tokenLong == tokenAddrs.token1Addr) {
            tokenToPayIn = tokenAddrs.token0Addr;

        }

        uint256 costToExercise = getExercisePrice(tokenId, percentage, tokenLong);
        (uint256 optionPayout, uint256 returnAmt) = placeTokensInEscrow(tokenId, percentage, tokenLong);
        itemIdToOptionInfo[tokenId] = OptionInfo({
            originalOwner: msg.sender,
            tokenId: tokenId,
            currentOwner: msg.sender,
            premium: premium,
            expiryDate: block.timestamp + duration,
            costToExercise: costToExercise,
            tokenLong: tokenLong,
            paymentToken: tokenToPayIn,
            optionPayout: optionPayout,
            amountToReturn: returnAmt,
            forSale: true
        });
        

    }

    function putUpOptionForSale(uint256 tokenId) external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(msg.sender == optionInfo.currentOwner, "you are not the owner!");
        itemIdToOptionInfo[tokenId].forSale = true;
    }

    function removeOptionForSale(uint256 tokenId) external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(msg.sender == optionInfo.currentOwner, "you are not the owner!");
        itemIdToOptionInfo[tokenId].forSale = false;
    }



    function changeOptionPremium(uint256 tokenId, uint256 newpremium) external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(msg.sender == optionInfo.currentOwner, "you are not the owner!");
        itemIdToOptionInfo[tokenId].premium = newpremium;
    }


    function buyOption(uint256 tokenId) payable external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(optionInfo.forSale, "this option is not for sale!");
        require(msg.sender != optionInfo.currentOwner, "you already own this option!");
        require(block.timestamp <= optionInfo.expiryDate, "option has already expired!");
        require(msg.value == optionInfo.premium, "not enough funds!");
        itemIdToOptionInfo[tokenId].currentOwner = msg.sender;
        itemIdToOptionInfo[tokenId].forSale = false;
        itemIdToOptionInfo[tokenId].currentOwner.transfer(optionInfo.premium - optionInfo.premium * marketplaceFee / 10000);
        

    }

    function exerciseOption(uint256 tokenId) external {
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(msg.sender == optionInfo.currentOwner, "you are not the owner!");
        uint256 feeCollected = optionInfo.costToExercise * marketplaceFee / 10000; //TODO: use amt to return in fee calc?
        uint256 amountDesired = optionInfo.costToExercise - feeCollected + optionInfo.amountToReturn;
        uint256 amountTransferred;

        ERC20(optionInfo.paymentToken).transferFrom(msg.sender, address(this), optionInfo.costToExercise);
        if (optionInfo.paymentToken == itemIdToTokenAddrs[tokenId].token0Addr) {
            (, amountTransferred, ) = UniswapNFTManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId:tokenId,
                amount0Desired: amountDesired,
                amount1Desired: 0,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 100

            }));

        }
        if (optionInfo.paymentToken == itemIdToTokenAddrs[tokenId].token1Addr) {
            (, ,amountTransferred) =  UniswapNFTManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId:tokenId,
                amount0Desired: 0,
                amount1Desired: amountDesired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 100

            }));

        }
        if (amountTransferred < amountDesired) {
            ERC20(optionInfo.paymentToken).transferFrom(msg.sender, optionInfo.originalOwner, amountDesired - amountTransferred);
        }
        ERC20(optionInfo.tokenLong).transferFrom(address(this), optionInfo.currentOwner, optionInfo.optionPayout- optionInfo.optionPayout*marketplaceFee/10000);
        UniswapNFTManager.safeTransferFrom(address(this), optionInfo.originalOwner, tokenId);
        tokenBalances[optionInfo.paymentToken] = tokenBalances[optionInfo.paymentToken]+ feeCollected;
        tokenBalances[optionInfo.tokenLong] = tokenBalances[optionInfo.tokenLong] + optionInfo.optionPayout*marketplaceFee/10000;
        removeItem(tokenId);
    
    }


    /**
    Deposits money in smart contract. used to collect fees. */
    function deposit(uint256 amount) external payable {
        require(msg.value == amount, "Insufficient funds");
    }

    /**
    Withdraws money from smart contract. */
    function withdraw() external {
        require(msg.sender == _owner, "You are not the owner!");
        msg.sender.transfer(address(this).balance);
    }
    function withdrawAllTokens() external {
        require(msg.sender == _owner, "You are not the owner!");
        for(uint i = 0; i < tokens.length; i++) {
            address currToken = tokens[i];
            if (tokenBalances[currToken] > 0) {
                ERC20(currToken).transferFrom(address(this),_owner,tokenBalances[currToken]);
            }
            tokenBalances[currToken] = 0;
            
        }
    }
    

    //utility function that pays out NFT to receiver.
    function payoutNFT(uint256 tokenId, address payoutReceiver) private {      
        (uint256 token0amt, uint256 token1amt) = UniswapNFTManager.collect(INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: payoutReceiver,
            amount0Max: 1000000000,
            amount1Max: 1000000000
         }));
          
    }

    //Withdraw fees earned from position
    function withdrawFees(uint256 tokenId) external {
        //needs to check that time to rent has not passed
        OptionInfo memory optionInfo = itemIdToOptionInfo[tokenId];
        require(block.timestamp < optionInfo.expiryDate, "the option has expired!");
        require(msg.sender == optionInfo.originalOwner, "you do not own this position!");
        //call collect and send back to renter
        payoutNFT(tokenId, optionInfo.currentOwner);   
    }


    function removeItem(uint256 tokenId) private {
        delete(itemIdToOptionInfo[tokenId]);
        if (itemIds.length > 1) {
            itemIdToIndex[itemIds[itemIds.length - 1]] = itemIdToIndex[tokenId];
            itemIds[itemIdToIndex[tokenId]] = itemIds[itemIds.length - 1]; 
            
        }
        itemIds.pop();
        delete(itemIdToIndex[tokenId]);

    }
}