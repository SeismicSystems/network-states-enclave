// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant deltax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant deltay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant deltay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

    
    uint256 constant IC0x = 14550097010928227845589266743979526520228221052244953705670536820388588844103;
    uint256 constant IC0y = 21529733246250417804700364880687411435053557894174604431755840211492739570845;
    
    uint256 constant IC1x = 16185997511015805740604061209473639323780235600186878219352268669760994635973;
    uint256 constant IC1y = 13739953411574891749451462911528285415391881984195751010840521636137367559005;
    
    uint256 constant IC2x = 9588863219167464422384838887971875877355878885715093510347151874926047042266;
    uint256 constant IC2y = 15550600483353951796968857138474555918172121512074044155581538003799478001595;
    
    uint256 constant IC3x = 20301391642451740669795020914866578657360219282105036184593689632280091633093;
    uint256 constant IC3y = 15180265568595923102911047048400229370665418595415626359883460853064520673107;
    
    uint256 constant IC4x = 7672774079781046087092506382536356521262707671203833295007290413868046506378;
    uint256 constant IC4y = 12505094099572087976985297344938969239551021967151344554289875511952932487745;
    
    uint256 constant IC5x = 20784765760019413333178468416773296783680868794944555676567444944741964799721;
    uint256 constant IC5y = 7007944483994167997131816999913748612542964706238953259892270246032708939876;
    
    uint256 constant IC6x = 2991898214263716254751298885312843559803340422889070669344294501434108604096;
    uint256 constant IC6y = 16202258971300252357189935842145261878378686007171675824692370862528342945285;
    
    uint256 constant IC7x = 21360601131725185822061281060155377387202324812359938567441855339891727048255;
    uint256 constant IC7y = 5156622298948214509749413805710491423473167077227364002956188474388806508360;
    
    uint256 constant IC8x = 13570744428101109615789248123225287057423744399560931424191264346235244884080;
    uint256 constant IC8y = 19612957276272209397054048357427991773471106263528260087491396085074920240233;
    
    uint256 constant IC9x = 14221212719809418350793931806616729532295255816686535651323828687315703465212;
    uint256 constant IC9y = 2918307647781826353400384743176848415210825445023062539692742178470510684216;
    
    uint256 constant IC10x = 19032901306430424524608578208635479190957895151497168470301805969577297667390;
    uint256 constant IC10y = 14591896456373495310086191797697475054827738376469226177765326877316865878340;
    
    uint256 constant IC11x = 11621226583983419287372558473607444968153457047371528130776265937077213088604;
    uint256 constant IC11y = 13083332150254599896356475896614880976755313385011867844101107363568993101577;
    
    uint256 constant IC12x = 4619332412595709822385688702130627795443825653865576460099910379205051620701;
    uint256 constant IC12y = 11682092642737997053447054289528832459184943051077371475221227173483467684478;
    
    uint256 constant IC13x = 7486529840197159947143818519626389633117343536541860802517594841371586177772;
    uint256 constant IC13y = 77086327772678037535713719848908588419978972663976001412521431522268411398;
    
    uint256 constant IC14x = 11271274809177453859464049980880695396455914206723093581520033552469742730746;
    uint256 constant IC14y = 5913789306279904387854694206934734377555158383983627765413451235074594563005;
    
    uint256 constant IC15x = 9320972942053470769264163750080585033019714488370075460778341876159390566510;
    uint256 constant IC15y = 7438343669147066824316185974638271563721649658655850760482515862753178305419;
    
    uint256 constant IC16x = 7215855274398585899412020645955614686201532134997269310047643466458533886977;
    uint256 constant IC16y = 6506219293361625040508357588451927352725588036289045623377556909523364654405;
    
    uint256 constant IC17x = 18216903308855706097996556292272803771948199459826834639679092837313045282751;
    uint256 constant IC17y = 14256717345416433350723262800300769272502828723822761716843634957305259957685;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[17] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, q)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
