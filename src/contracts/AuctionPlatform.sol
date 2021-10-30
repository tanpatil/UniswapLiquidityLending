

// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/base/Multicall.sol";


/// @title NFT positions
/// @notice Wraps Uniswap V3 positions in the ERC721 non-fungible token interface
contract AuctionPlatform is
    Multicall,
    IERC721Receiver
{
    INonfungiblePositionManager public immutable UniswapNFTManager =  INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    struct AuctionInfo {
        address payable originalOwner;
        address payable highestBidder;
        uint256 tokenId;
        uint256 expiryDate;
        uint256 highestBid;
    }


    mapping(uint256 => AuctionInfo) public itemIdToAuctionInfo;
    mapping(uint256 => uint256) private itemIdToIndex;
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


    //Owner places NFT inside contract until they remove it or auction completes
    function putUpNFTForAuction(uint256 tokenId, uint256 minBid, uint256 duration) external {
        UniswapNFTManager.safeTransferFrom(msg.sender, address(this), tokenId);
        itemIds.push(tokenId);
        itemIdToIndex[tokenId] = itemIds.length - 1;
        itemIdToAuctionInfo[tokenId] = AuctionInfo({
            tokenId: tokenId,
            originalOwner: msg.sender,
            highestBid: minBid,
            expiryDate: block.timestamp + duration,
            highestBidder: address(0)
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
    
    //utility function that pays out NFT to receiver.
    function payoutNFT(uint256 tokenId, address payoutReceiver) private {      
        (uint256 token0amt, uint256 token1amt) = UniswapNFTManager.collect(INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: payoutReceiver,
            amount0Max: 1000000000,
            amount1Max: 1000000000
         }));
 
    }

    function bidOnNFT(uint256 tokenId) public payable {
        AuctionInfo memory auctionInfo = itemIdToAuctionInfo[tokenId];
        require(msg.value > auctionInfo.highestBid, "Insufficient funds");
        require(msg.sender != auctionInfo.originalOwner,  "You already own this NFT!");
        require(auctionInfo.expiryDate >  block.timestamp, "Auction has already expired!");
        itemIdToAuctionInfo[auctionInfo.tokenId] = AuctionInfo({
            tokenId: auctionInfo.tokenId,
            expiryDate: auctionInfo.expiryDate,
            highestBid: msg.value,
            originalOwner: auctionInfo.originalOwner,
            highestBidder: msg.sender
        });
    }

    //Original Owner can Withdraw fees earned from NFT while it is on auction
    function withdrawFees(uint256 tokenId) external {
        AuctionInfo memory auctionInfo = itemIdToAuctionInfo[tokenId];
        require(msg.sender == auctionInfo.originalOwner, "you do not own this asset!");
        //call collect and send back to seller
        payoutNFT(tokenId, auctionInfo.originalOwner);
        
    }

    function sendNFTToHighestBidder(uint256 tokenId) external {
        AuctionInfo memory auctionInfo = itemIdToAuctionInfo[tokenId];
        require(msg.sender == auctionInfo.highestBidder, "You are not the highest bidder!");
        require(auctionInfo.expiryDate < block.timestamp, "Auction is still ongoing!");
        payoutNFT(tokenId, auctionInfo.originalOwner);
        auctionInfo.originalOwner.transfer(auctionInfo.highestBid - auctionInfo.highestBid * marketplaceFee / 10000); 
        removeItem(tokenId);
        UniswapNFTManager.safeTransferFrom(address(this), auctionInfo.highestBidder, tokenId);
    }


    //returns NFT to original owner
    function returnNFTToOwner(uint256 tokenId) external {
        AuctionInfo memory auctionInfo = itemIdToAuctionInfo[tokenId];
        require(msg.sender == auctionInfo.originalOwner, "you are not the original owner!");

        // either auction is over and no one bid, or auction is ongoing
        require((auctionInfo.expiryDate > block.timestamp && auctionInfo.highestBidder == address(0) )|| auctionInfo.expiryDate < block.timestamp, "you cannot retrive this asset!");
        //return control to original owner
        address owner = auctionInfo.originalOwner;
        removeItem(tokenId);
        UniswapNFTManager.safeTransferFrom(address(this), owner, tokenId);

    }

    function removeItem(uint256 tokenId) private {
        delete(itemIdToAuctionInfo[tokenId]);
        if (itemIds.length > 1) {
            itemIdToIndex[itemIds[itemIds.length - 1]] = itemIdToIndex[tokenId];
            itemIds[itemIdToIndex[tokenId]] = itemIds[itemIds.length - 1]; 
        }
        itemIds.pop();
        delete(itemIdToIndex[tokenId]);
    }


}