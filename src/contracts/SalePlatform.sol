

// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/base/Multicall.sol";

import "utils/structs/tokenAddresses.sol";




/// @title NFT positions
/// @notice Wraps Uniswap V3 positions in the ERC721 non-fungible token interface
contract SalePlatform is
    Multicall,
    IERC721Receiver
{
    INonfungiblePositionManager public immutable UniswapNFTManager =  INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    struct SaleInfo {
        address payable originalOwner;
        uint256 tokenId;
        uint256 price;

    }


    mapping(uint256 => SaleInfo) public itemIdToSaleInfo;
    mapping(uint256 => uint256) private itemIdToIndex;
    mapping(uint256 => TokenAddresses) public itemIdToTokenAddrs;

    uint256[] public itemIds;
    uint256 public marketplaceFee; /// fee taken from seller, where a 1.26% fee is represented as 126. Calculate fee by doing price * marketplaceFee / 10,000
    address public _owner;

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
        itemIdToTokenAddrs[tokenId] = TokenAddresses({ token0Addr: token0, token1Addr: token1 });
        
    }


    //Owner places NFT inside contract until they remove it or it gets sold
    function putUpNFTForSale(uint256 tokenId, uint256 price) external {
        UniswapNFTManager.safeTransferFrom(msg.sender, address(this), tokenId);
        itemIds.push(tokenId);
        cacheTokenAddrs(tokenId);
        itemIdToIndex[tokenId] = itemIds.length - 1;
        itemIdToSaleInfo[tokenId] = SaleInfo({
            tokenId: tokenId,
            originalOwner: msg.sender,
            price: price
        });
    }

    /**
    Deposits money in smart contract. used to collect fees. */
    function deposit(uint256 amount) public payable {
        require(msg.value == amount, "Insufficient funds");
    }

    /**
    Withdraws money from smart contract. */
    function withdraw() public {
        require(msg.sender == _owner, "You are not the owner!");
        msg.sender.transfer(address(this).balance);
    }
    
    //Original Owner removes NFT from sale availability
    function removeNFTForSale(uint256 tokenId) external {
        SaleInfo memory saleInfo = itemIdToSaleInfo[tokenId];
        require(saleInfo.originalOwner == msg.sender, "you do not own this NFT!");
        UniswapNFTManager.safeTransferFrom(address(this),saleInfo.originalOwner, tokenId);
        removeItem(tokenId);
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

    function buyNFT(uint256 tokenId) public payable {
        SaleInfo memory saleInfo = itemIdToSaleInfo[tokenId];
        require(msg.value >= saleInfo.price, "Insufficient funds");
        require(msg.sender != saleInfo.originalOwner,  "You already own this NFT!");
        saleInfo.originalOwner.transfer(saleInfo.price - saleInfo.price * marketplaceFee / 10000); 
        UniswapNFTManager.safeTransferFrom(address(this), msg.sender, tokenId);
        removeItem(tokenId);

    }

    //Original Owner can Withdraw fees earned from NFT while it is on sale
    function withdrawFees(uint256 tokenId) external {
        SaleInfo memory saleInfo = itemIdToSaleInfo[tokenId];
        require(msg.sender == saleInfo.originalOwner, "you do not own this asset!");
        //call collect and send back to seller
        payoutNFT(tokenId, saleInfo.originalOwner);
        
    }

    //returns NFT to original owner
    function returnNFTToOwner(uint256 tokenId) external {
        SaleInfo memory saleInfo = itemIdToSaleInfo[tokenId];
        require(msg.sender == saleInfo.originalOwner, "you are not the original owner!");
        //return control to original owner
        address owner = saleInfo.originalOwner;
        removeItem(tokenId);(tokenId);
        UniswapNFTManager.safeTransferFrom(address(this), owner, tokenId);

    }

      function removeItem(uint256 tokenId) private {
        delete(itemIdToSaleInfo[tokenId]);
        if (itemIds.length > 1) {
            itemIdToIndex[itemIds[itemIds.length - 1]] = itemIdToIndex[tokenId];
            itemIds[itemIdToIndex[tokenId]] = itemIds[itemIds.length - 1]; 
        }
        itemIds.pop();
        delete(itemIdToIndex[tokenId]);
    }

}