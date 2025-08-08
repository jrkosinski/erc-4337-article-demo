import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Wallet } from 'ethers';

describe('AccountAbstraction', function () {
    let paymasterAccount: HardhatEthersSigner;
    let accountOwnerAccount: HardhatEthersSigner;
    let signer0: HardhatEthersSigner;
    let signer1: HardhatEthersSigner;
    let entryPoint: any;
    let accountFactory: any;
    let paymaster: any;

    async function deployAccountFactory(withAuth: boolean = false) {
        const AccountFactoryFactory =
            await hre.ethers.getContractFactory('AccountFactory');
        accountFactory = await AccountFactoryFactory.deploy(
            entryPoint.target,
            withAuth
        );
    }

    async function fundGas(
        from: HardhatEthersSigner | Wallet,
        to: string,
        amount: string = '1'
    ) {
        console.log('funding gas from', from.address, 'to', to);
        const tx = await from.sendTransaction({
            to,
            value: hre.ethers.parseEther(amount),
        });
        await tx.wait();
    }

    //returns the address of the newly created account (address of Account contract)
    async function createNewAccount(
        signer: HardhatEthersSigner | Wallet,
        useAuth: boolean = false,
        callData: any = '0x'
    ): Promise<{ receipt: any; sender: string }> {
        const sender = await hre.ethers.getCreateAddress({
            from: accountFactory.target,
            nonce: 1,
        });

        //sender userop
        return await sendUserOp(signer, sender, useAuth, callData, true);
    }

    async function sendUserOp(
        signer: HardhatEthersSigner | Wallet,
        sender: string,
        useAuth: boolean = false,
        callData: any = '0x',
        createAccount: boolean = false,
        paymaster: any = undefined
    ): Promise<{ receipt: any; sender: string }> {
        //get contract factories
        const AccountFactoryFactory =
            await hre.ethers.getContractFactory('AccountFactory');

        //generate initCode for createAccount
        const initCode = createAccount
            ? accountFactory.target +
              AccountFactoryFactory.interface
                  .encodeFunctionData('createAccount', [signer.address])
                  .substring(2)
            : '0x';

        //deposit funds to the Entrypoint
        await entryPoint.depositTo(sender, {
            value: hre.ethers.parseEther('100'),
        });

        //get EP nonce
        const nonce = await entryPoint.getNonce(sender, 0);

        //create the user op
        const userOp: any = {
            sender,
            nonce,
            initCode,
            callData,
            callGasLimit: 200_000_000,
            accountGasLimits:
                '0x0000000000000000000020000000000000000000000000000000000000200000',
            preVerificationGas: 200_000_000,
            gasFees:
                '0x0000000000000000000000000002000000000000000000000000000000200000',
            paymasterAndData: paymaster
                ? `${paymaster.target.padEnd(254, '0')}`
                : '0x',
            signature: '0x',
        };

        //sign the user operation
        if (useAuth) {
            userOp.signature = signer.signMessage(
                ethers.getBytes(await entryPoint.getUserOpHash(userOp))
            );
        }

        //send the userop
        const tx = await entryPoint.handleOps(
            [userOp],
            paymasterAccount.address
        );
        const receipt = await tx.wait();

        return { sender, receipt };
    }

    async function sendUserOpWithSigner(
        owner: HardhatEthersSigner | Wallet,
        signer: HardhatEthersSigner | Wallet,
        sender: string,
        callData: any = '0x'
    ): Promise<{ receipt: any; sender: string }> {
        //get contract factories
        const AccountFactoryFactory =
            await hre.ethers.getContractFactory('AccountFactory');

        //generate initCode for createAccount
        const initCode = '0x';

        //deposit funds to the Entrypoint
        await entryPoint.depositTo(sender, {
            value: hre.ethers.parseEther('100'),
        });

        //get EP nonce
        const nonce = await entryPoint.getNonce(sender, 0);

        //create the user op
        const userOp: any = {
            sender,
            nonce,
            initCode,
            callData,
            callGasLimit: 200_000_000,
            accountGasLimits:
                '0x0000000000000000000020000000000000000000000000000000000000200000',
            preVerificationGas: 200_000_000,
            gasFees:
                '0x0000000000000000000000000002000000000000000000000000000000200000',
            paymasterAndData: '0x',
            signature: '0x',
        };

        //sign the user operation
        userOp.signature = signer.signMessage(
            ethers.getBytes(await entryPoint.getUserOpHash(userOp))
        );

        //send the userop
        const tx = await entryPoint.handleOps(
            [userOp],
            paymasterAccount.address
        );
        const receipt = await tx.wait();

        return { sender, receipt };
    }

    async function sendUserOpWithPaymaster(
        signer: HardhatEthersSigner,
        sender: string,
        useAuth: boolean = false,
        callData: any = '0x',
        createAccount: boolean = false
    ): Promise<{ receipt: any; sender: string }> {
        return sendUserOp(
            signer,
            sender,
            useAuth,
            callData,
            createAccount,
            paymaster
        );
    }

    this.beforeEach(async () => {
        const [a1, a2, a3, a4, a5, a6, a7, a8, a9] =
            await hre.ethers.getSigners();

        paymasterAccount = a1;
        accountOwnerAccount = a2;
        signer0 = a3;
        signer1 = a4;

        //deploy entry point
        const EntryPointFactory =
            await hre.ethers.getContractFactory('EntryPoint');
        entryPoint = await EntryPointFactory.deploy();

        //deploy account factory
        await deployAccountFactory(false);

        //deploy paymaster
        const PaymasterFactory =
            await hre.ethers.getContractFactory('Paymaster');
        paymaster = await PaymasterFactory.deploy(entryPoint.target);

        //fund paymaster
        await fundGas(signer1, paymaster.target, '210');
        await paymaster.connect(signer1).deposit({
            value: hre.ethers.parseEther('100'),
        });
    });

    describe('Deployment', function () {
        it('can deploy entry point', async function () {
            await expect(entryPoint.getNonce(accountOwnerAccount.address, 0)).to
                .not.be.reverted;
            expect(
                await entryPoint.getNonce(accountOwnerAccount.address, 0)
            ).to.equal(0);
        });

        it('can deploy account factory', async function () {
            expect(await accountFactory.entryPoint()).to.equal(
                entryPoint.target
            );
        });
    });

    describe('User Operations', function () {
        it('can create account and send user op in separate steps', async function () {
            const { sender, receipt } = await createNewAccount(signer0);

            //TODO: find a better way to get the address
            const accountAddress = receipt.logs[1].args[1];
            expect(accountAddress).to.equal(sender);

            const account = await hre.ethers.getContractAt(
                'Account',
                accountAddress
            );

            //verify the counter is zero
            console.log('counter:', await account.getCounter());
            expect(await account.getCounter()).to.equal(0);

            //create call data for modifyState
            const AccountFactory =
                await hre.ethers.getContractFactory('Account');
            const callData = AccountFactory.interface.encodeFunctionData(
                'execute',
                [
                    sender,
                    0,
                    AccountFactory.interface.encodeFunctionData('modifyState'),
                ]
            );

            //initially should be 0
            expect(await account.getCounter()).to.equal(0);

            //call first time
            await sendUserOp(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(1);

            //call second time
            await sendUserOp(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(2);

            //call third time
            await sendUserOp(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(3);
        });
    });

    describe('Authentication', function () {
        this.beforeEach(async () => {
            //deploy account factory that requires auth
            await deployAccountFactory(true);
        });

        it('can authenticate user operations', async function () {
            const { sender, receipt } = await createNewAccount(signer0, true);

            //TODO: find a better way to get the address
            const accountAddress = receipt.logs[1].args[1];
            expect(accountAddress).to.equal(sender);

            //get the actual new smart account contract
            const account = await hre.ethers.getContractAt(
                'Account',
                accountAddress
            );

            //verify the counter is zero
            console.log('counter:', await account.getCounter());
            expect(await account.getCounter()).to.equal(0);

            //create call data for modifyState
            const AccountFactory =
                await hre.ethers.getContractFactory('Account');
            const callData = AccountFactory.interface.encodeFunctionData(
                'execute',
                [
                    sender,
                    0,
                    AccountFactory.interface.encodeFunctionData('modifyState'),
                ]
            );

            //initially should be 0
            expect(await account.getCounter()).to.equal(0);

            //call first time
            await sendUserOp(signer0, sender, true, callData);
            expect(await account.getCounter()).to.equal(1);

            //call second time
            await sendUserOp(signer0, sender, true, callData);
            expect(await account.getCounter()).to.equal(2);

            //call third time
            await sendUserOp(signer0, sender, true, callData);
            expect(await account.getCounter()).to.equal(3);
        });

        it('can authenticate using an ad-hoc key', async function () {
            const adHocSigner = new Wallet(
                `0x${Buffer.from(ethers.randomBytes(32)).toString('hex')}`,
                signer0.provider
            );

            const { sender, receipt } = await createNewAccount(
                adHocSigner,
                true
            );

            //TODO: find a better way to get the address
            const accountAddress = receipt.logs[1].args[1];
            expect(accountAddress).to.equal(sender);

            //get the actual new smart account contract
            const account = await hre.ethers.getContractAt(
                'Account',
                accountAddress
            );

            //verify the counter is zero
            console.log('counter:', await account.getCounter());
            expect(await account.getCounter()).to.equal(0);

            //create call data for modifyState
            const AccountFactory =
                await hre.ethers.getContractFactory('Account');
            const callData = AccountFactory.interface.encodeFunctionData(
                'execute',
                [
                    sender,
                    0,
                    AccountFactory.interface.encodeFunctionData('modifyState'),
                ]
            );

            //initially should be 0
            expect(await account.getCounter()).to.equal(0);

            //call first time
            await sendUserOp(adHocSigner, sender, true, callData);
            expect(await account.getCounter()).to.equal(1);

            //call second time
            await sendUserOp(adHocSigner, sender, true, callData);
            expect(await account.getCounter()).to.equal(2);

            //call third time
            await sendUserOp(adHocSigner, sender, true, callData);
            expect(await account.getCounter()).to.equal(3);
        });

        it('cannot authenticate to unauthorized user account', async function () {
            const adHocSigner = new Wallet(
                `0x${Buffer.from(ethers.randomBytes(32)).toString('hex')}`,
                signer0.provider
            );

            const { sender, receipt } = await createNewAccount(
                adHocSigner,
                true
            );

            //TODO: find a better way to get the address
            const accountAddress = receipt.logs[1].args[1];
            expect(accountAddress).to.equal(sender);

            //get the actual new smart account contract
            const account = await hre.ethers.getContractAt(
                'Account',
                accountAddress
            );

            //verify the counter is zero
            console.log('counter:', await account.getCounter());
            expect(await account.getCounter()).to.equal(0);

            //create call data for modifyState
            const AccountFactory =
                await hre.ethers.getContractFactory('Account');
            const callData = AccountFactory.interface.encodeFunctionData(
                'execute',
                [
                    sender,
                    0,
                    AccountFactory.interface.encodeFunctionData('modifyState'),
                ]
            );

            //initially should be 0
            expect(await account.getCounter()).to.equal(0);

            //call with right user
            await sendUserOp(adHocSigner, sender, true, callData);
            expect(await account.getCounter()).to.equal(1);

            //call with wrong user, should revert & have no effect
            await expect(
                sendUserOpWithSigner(adHocSigner, signer0, sender, callData)
            ).to.be.reverted;
            expect(await account.getCounter()).to.equal(1);
        });
    });

    describe.skip('Paymaster', function () {
        this.beforeEach(async () => {
            //deploy account factory that requires auth
            //await deployAccountFactory(true);
        });

        it('can create account and send user op in separate steps, no authentication', async function () {
            const { sender, receipt } = await createNewAccount(signer0, false);

            //TODO: find a better way to get the address
            const accountAddress = receipt.logs[1].args[1];
            expect(accountAddress).to.equal(sender);

            const account = await hre.ethers.getContractAt(
                'Account',
                accountAddress
            );

            //verify the counter is zero
            console.log('counter:', await account.getCounter());
            expect(await account.getCounter()).to.equal(0);

            //create call data for modifyState
            const AccountFactory =
                await hre.ethers.getContractFactory('Account');
            const callData = AccountFactory.interface.encodeFunctionData(
                'execute',
                [
                    sender,
                    0,
                    AccountFactory.interface.encodeFunctionData('modifyState'),
                ]
            );

            //initially should be 0
            expect(await account.getCounter()).to.equal(0);

            //call first time
            await sendUserOpWithPaymaster(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(1);

            //call second time
            await sendUserOpWithPaymaster(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(2);

            //call third time
            await sendUserOpWithPaymaster(signer0, sender, false, callData);
            expect(await account.getCounter()).to.equal(3);
        });
    });
});
