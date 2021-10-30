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
contract SwapPlatform is
    Multicall,
    IERC721Receiver
{
    INonfungiblePositionManager public immutable UniswapNFTManager =  INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

  struct SwapInfo {
        address payable originalOwner;
        address payable renter;
        uint256 tokenId;
        uint256 duration;
        uint256 expiryDate;
    } 


    mapping(uint256 => mapping(uint256 => bool)) offeredPositions;
    mapping(uint256 => SwapInfo) public itemIdToSwapInfo;
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


    //Owner places NFT inside contract until they remove it or get an agreement
    function putUpNFTForSwap(uint256 tokenId, uint256 duration) external {
        UniswapNFTManager.safeTransferFrom(msg.sender, address(this), tokenId);
        cacheTokenAddrs(tokenId);
        itemIds.push(tokenId);
        itemIdToIndex[tokenId] = itemIds.length - 1;
        itemIdToSwapInfo[tokenId] = SwapInfo({
            tokenId: tokenId,
            originalOwner: msg.sender,
            duration: duration,
            expiryDate: 0,
            renter: address(0)
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
    
    //Owner removes NFT from rent availability
    function removeNFTForSwap(uint256 tokenId) external {
        SwapInfo memory swapInfo = itemIdToSwapInfo[tokenId];
        require(swapInfo.renter == address(0),"someone is renting right now!");
        require(swapInfo.originalOwner == msg.sender, "you do not own this NFT!");
        UniswapNFTManager.safeTransferFrom(address(this),swapInfo.originalOwner, tokenId);
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

    function offerSwapFromExisting(uint256 tokenIdOfExisting, uint256 tokenIdOfOffer) private {
        SwapInfo memory swapInfoOfOffer= itemIdToSwapInfo[tokenIdOfOffer];
        require(swapInfoOfOffer.originalOwner == msg.sender, "you are not the owner!");
        require(swapInfoOfOffer.duration == itemIdToSwapInfo[tokenIdOfExisting].duration, "swap offers are of different durations!");
        offeredPositions[tokenIdOfExisting][tokenIdOfOffer] = true;

    }


    //Added by Tanay
    function offerSwap(uint256 tokenIdOfExisting, uint256 tokenIdOfOffer) external payable {
        //check if price is enough
        SwapInfo memory swapInfoOfExisting = itemIdToSwapInfo[tokenIdOfExisting];
        require(swapInfoOfExisting.renter == address(0), "already being rented!");
        //update who the renter is
        if (itemIdToSwapInfo[tokenIdOfOffer].originalOwner == address(0)) {
            offeredPositions[tokenIdOfExisting][tokenIdOfOffer] = true;
        itemIdToSwapInfo[tokenIdOfOffer] = SwapInfo({
            tokenId: tokenIdOfOffer,
            originalOwner: msg.sender,
            renter: address(0),
            duration: swapInfoOfExisting.duration,
            expiryDate: 0
        });
        UniswapNFTManager.safeTransferFrom(msg.sender, address(this), tokenIdOfOffer);

        }
        else {
            offerSwapFromExisting(tokenIdOfExisting, tokenIdOfOffer);
        }
        
        
    }

    function acceptSwap(uint256 tokenIdOfExisting, uint256 tokenIdOfOffer) external {
        SwapInfo memory swapInfoOfExisting = itemIdToSwapInfo[tokenIdOfExisting];
        require(swapInfoOfExisting.renter == address(0), "already being rented!");
        require(offeredPositions[tokenIdOfExisting][tokenIdOfOffer] == true, "this position has not been offered for swapping!");
        require(msg.sender == swapInfoOfExisting.originalOwner, "you are not the owner!");

        SwapInfo memory swapInfoOfOffer = itemIdToSwapInfo[tokenIdOfOffer];
        itemIdToSwapInfo[tokenIdOfExisting] = SwapInfo({
        originalOwner:swapInfoOfExisting.originalOwner,
        renter: swapInfoOfOffer.originalOwner,
        tokenId: tokenIdOfExisting,
        duration: swapInfoOfExisting.duration,
        expiryDate: swapInfoOfExisting.duration+ block.timestamp
        });

        itemIdToSwapInfo[tokenIdOfOffer] = SwapInfo({
            originalOwner: swapInfoOfOffer.originalOwner,
            renter: swapInfoOfExisting.originalOwner,
            tokenId: tokenIdOfOffer,
            duration: swapInfoOfExisting.duration,
            expiryDate: swapInfoOfExisting.duration+ block.timestamp
        });
        
        offeredPositions[tokenIdOfExisting][tokenIdOfOffer] = false;
    }

    //Withdraw fees earned from swap NFT
    function withdrawFees(uint256 tokenId) external {
        //needs to check that time to rent has not passed
        SwapInfo memory swapInfo = itemIdToSwapInfo[tokenId];
        require(block.timestamp < swapInfo.expiryDate, "the lease has expired!");
        require(msg.sender == swapInfo.renter, "you are not renting this asset!");
        //call collect and send back to renter
        payoutNFT(tokenId, swapInfo.renter);
        
    }

    //returns NFT to original owner once original rent period is up
    function returnNFTToOwner(uint256 tokenId) external {
        //check that rent period is up
        SwapInfo memory swapInfo = itemIdToSwapInfo[tokenId];
        require(block.timestamp >= swapInfo.expiryDate, "the lease has not expired yet!");
        require(msg.sender == swapInfo.originalOwner, "you are not the original owner!");
        //return control to original owner
        address owner = swapInfo.originalOwner;
        removeItem(tokenId);
        UniswapNFTManager.safeTransferFrom(address(this), owner, tokenId);

    }

    function removeItem(uint256 tokenId) private {
        delete(itemIdToSwapInfo[tokenId]);
        if (itemIds.length > 1) {
            itemIdToIndex[itemIds[itemIds.length - 1]] = itemIdToIndex[tokenId];
            itemIds[itemIdToIndex[tokenId]] = itemIds[itemIds.length - 1]; 
        }
        itemIds.pop();
        delete(itemIdToIndex[tokenId]);
    }
}